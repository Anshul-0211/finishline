import { NextRequest, NextResponse } from "next/server";
import { fetchRecentEmails } from "@/lib/services/gmail";
import { callGemini } from "@/lib/ai/gemini";
import { gmailSuggestionSchema, GmailSuggestion } from "@/lib/ai/schemas/gmailSuggestion";
import { buildGmailClassifierPrompt, GMAIL_CLASSIFIER_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/gmailClassifier";

function sanitizeGmailSuggestion(parsed: any, originalMsg: { id: string; subject: string; from: string }): any {
  if (!parsed || typeof parsed !== "object") {
    parsed = {};
  }

  // Force original ID and headers to match correct metadata
  parsed.gmailMessageId = parsed.gmailMessageId || originalMsg.id;
  parsed.subject = parsed.subject || originalMsg.subject;
  parsed.from = parsed.from || originalMsg.from;

  // Enforce types and defaults
  parsed.hasCommitment = typeof parsed.hasCommitment === "boolean" ? parsed.hasCommitment : false;
  parsed.extractedTitle = parsed.extractedTitle || "";
  parsed.extractedDeadline = parsed.extractedDeadline || null;
  
  if (parsed.extractedEffort !== undefined && parsed.extractedEffort !== null) {
    parsed.extractedEffort = Number(parsed.extractedEffort) || null;
  } else {
    parsed.extractedEffort = null;
  }

  const validDomains = ["academic", "work", "personal", "health", "social", "family"];
  if (!validDomains.includes(parsed.extractedDomain)) {
    parsed.extractedDomain = "work";
  }

  parsed.confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0.5;
  parsed.reasoning = parsed.reasoning || "";

  const validUrgencies = ["low", "medium", "high", "critical"];
  if (!validUrgencies.includes(parsed.urgencyLevel)) {
    parsed.urgencyLevel = "low";
  }

  const validImportances = ["low", "medium", "high", "recruiter", "vip"];
  if (!validImportances.includes(parsed.senderImportance)) {
    parsed.senderImportance = "low";
  }

  parsed.requiresResponse = typeof parsed.requiresResponse === "boolean" ? parsed.requiresResponse : false;
  parsed.responseDeadline = parsed.responseDeadline || null;

  return parsed;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, maxEmails = 20 } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let emails: Array<{ id: string; subject: string; from: string; body: string }> = [];
    try {
      emails = await fetchRecentEmails(userId, maxEmails);
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.includes("refresh token") || msg.includes("credentials") || msg.includes("auth") || msg.includes("Unauthorized")) {
        return NextResponse.json({ error: "Gmail not connected", details: msg }, { status: 401 });
      }
      throw err;
    }

    const suggestions: GmailSuggestion[] = [];
    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    console.log(`[Gmail Scan] Running AI classification for ${emails.length} emails...`);
    for (const email of emails) {
      try {
        const prompt = buildGmailClassifierPrompt(email.id, email.subject, email.from, email.body, today);
        
        const result = await callGemini({
          systemInstruction: GMAIL_CLASSIFIER_SYSTEM_INSTRUCTION,
          prompt,
          schema: gmailSuggestionSchema as any,
          endpointType: "extraction",
        });

        const sanitized = sanitizeGmailSuggestion(result, email);
        const parsed = gmailSuggestionSchema.parse(sanitized);

        // Confidence Gate: Filter out low confidence classifications (< 0.40)
        // Commitment Gate: Only return emails classified as having a commitment
        if (parsed.hasCommitment && parsed.confidence >= 0.40) {
          suggestions.push(parsed);
        }
      } catch (err: any) {
        console.error(`[Gmail Scan] Failed to classify message ID: ${email.id}. Error:`, err.message);
        // Continue processing other emails silently
      }
    }

    console.log(`[Gmail Scan] Scan complete. Found ${suggestions.length} suggestions.`);
    return NextResponse.json(suggestions, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Gmail Scan] Critical error running scan:", msg);
    return NextResponse.json({ error: "Gmail scan failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
