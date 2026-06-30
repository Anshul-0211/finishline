import { NextRequest, NextResponse } from "next/server";
import { callGateway } from "@/lib/ai/gateway";
import { commitmentDraftFullArraySchema } from "@/lib/ai/schemas/commitmentDraftFull";
import { buildFileExtractionPrompt, FILE_EXTRACTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/fileExtraction";
import { verifyAuth } from "@/lib/auth/authVerification";
import { resolveUserTimezone } from "@/lib/ai/timezone";

function sanitizeExtractedCommitments(parsed: unknown): any[] {
  if (!parsed) return [];
  
  let list: any[] = [];
  if (Array.isArray(parsed)) {
    list = parsed;
  } else if (typeof parsed === "object") {
    list = [parsed];
  } else {
    return [];
  }

  return list.map((item) => {
    if (!item || typeof item !== "object") return item;

    // Ensure extractedEntities is an object with required arrays (not null/undefined)
    if (!item.extractedEntities || typeof item.extractedEntities !== "object") {
      item.extractedEntities = { people: [], locations: [], tools: [] };
    } else {
      if (!Array.isArray(item.extractedEntities.people)) item.extractedEntities.people = [];
      if (!Array.isArray(item.extractedEntities.locations)) item.extractedEntities.locations = [];
      if (!Array.isArray(item.extractedEntities.tools)) item.extractedEntities.tools = [];
    }

    // Ensure prerequisiteKnowledge is an array
    if (!Array.isArray(item.prerequisiteKnowledge)) {
      item.prerequisiteKnowledge = [];
    }

    // Ensure practicalVsTheoretical is null if not provided
    if (item.practicalVsTheoretical === undefined) {
      item.practicalVsTheoretical = null;
    }

    // Ensure questionCount is null if not provided
    if (item.questionCount === undefined) {
      item.questionCount = null;
    }

    // Ensure recommendedSessions is a non-negative number
    if (typeof item.recommendedSessions !== "number") {
      item.recommendedSessions = Number(item.recommendedSessions) || 0;
    }

    // Ensure effortEstimateHours is a non-negative number
    if (typeof item.effortEstimateHours !== "number") {
      item.effortEstimateHours = Number(item.effortEstimateHours) || 0.5;
    }

    // Ensure confidence is a number between 0 and 1
    if (typeof item.confidence !== "number") {
      item.confidence = Number(item.confidence) || 0.8;
    }

    return item;
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const decoded = await verifyAuth(req);

    const body = await req.json();
    const { fileUrl, mimeType, timezone: requestedTimezone } = body;
    const timezone = await resolveUserTimezone(decoded.uid, requestedTimezone);

    if (!fileUrl || !mimeType) {
      return NextResponse.json({ error: "Missing fileUrl or mimeType" }, { status: 400 });
    }

    // 1. Download the file from Firebase Storage / HTTP URL
    console.log(`[extract-file] Downloading file from URL: ${fileUrl}...`);
    const fileRes = await fetch(fileUrl);
    if (!fileRes.ok) {
      throw new Error(`Failed to download file from storage URL: ${fileRes.statusText}`);
    }
    const arrayBuffer = await fileRes.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    console.log(`[extract-file] Downloaded ${fileBuffer.length} bytes.`);

    // 2. Build the prompt
    const todayDate = new Date();
    const todayStr = todayDate.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD in user's timezone
    const weekday = todayDate.toLocaleDateString("en-US", { timeZone: timezone, weekday: "long" }); // e.g., Tuesday
    const fullDateName = todayDate.toLocaleDateString("en-US", { timeZone: timezone, year: "numeric", month: "long", day: "numeric" }); // e.g., June 30, 2026
    const today = `${weekday}, ${fullDateName} (${todayStr})`; // e.g., Tuesday, June 30, 2026 (2026-06-30)
    const prompt = buildFileExtractionPrompt(today, timezone);

    // 3. Make the Multimodal Call via unified Gateway
    const result = await callGateway({
      systemInstruction: FILE_EXTRACTION_SYSTEM_INSTRUCTION,
      prompt,
      schema: commitmentDraftFullArraySchema,
      endpointType: "extraction",
      multimodalData: {
        data: fileBuffer.toString("base64"),
        mimeType: mimeType
      }
    });

    const sanitized = sanitizeExtractedCommitments(result);
    const parsedResult = commitmentDraftFullArraySchema.parse(sanitized);

    return NextResponse.json(parsedResult, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract-file] File extraction failed with critical error:", msg);
    return NextResponse.json({ error: "File extraction failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
