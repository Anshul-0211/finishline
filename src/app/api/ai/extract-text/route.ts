import { NextRequest, NextResponse } from "next/server";
import { callGateway } from "@/lib/ai/gateway";
import { commitmentDraftArraySchema } from "@/lib/ai/schemas/commitmentDraft";
import { buildExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/extraction";
import { verifyAuth } from "@/lib/auth/authVerification";
import { resolveUserTimezone } from "@/lib/ai/timezone";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const decoded = await verifyAuth(req);

    const body = await req.json();
    const { input, timezone: requestedTimezone } = body;
    const timezone = await resolveUserTimezone(decoded.uid, requestedTimezone);

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const todayDate = new Date();
    const todayStr = todayDate.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD in user's timezone
    const weekday = todayDate.toLocaleDateString("en-US", { timeZone: timezone, weekday: "long" }); // e.g., Tuesday
    const fullDateName = todayDate.toLocaleDateString("en-US", { timeZone: timezone, year: "numeric", month: "long", day: "numeric" }); // e.g., June 30, 2026
    const today = `${weekday}, ${fullDateName} (${todayStr})`; // e.g., Tuesday, June 30, 2026 (2026-06-30)
    const prompt = buildExtractionPrompt(input, today, timezone);

    const result = await callGateway({
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      prompt,
      schema: commitmentDraftArraySchema,
      endpointType: "extraction",
    });

    return NextResponse.json(result, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract-text] AI extraction failed:", msg);
    return NextResponse.json({ error: "Extraction failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
