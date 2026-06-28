import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini";
import { commitmentDraftArraySchema } from "@/lib/ai/schemas/commitmentDraft";
import { buildExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/extraction";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { input, timezone = "UTC" } = body;

    if (!input) {
      return NextResponse.json({ error: "Missing input" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const prompt = buildExtractionPrompt(input, today, timezone);

    const result = await callGemini({
      systemInstruction: EXTRACTION_SYSTEM_INSTRUCTION,
      prompt,
      schema: commitmentDraftArraySchema,
      endpointType: "extraction",
    });

    return NextResponse.json(result, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[extract-text] AI extraction failed:", msg);
    return NextResponse.json({ error: "Extraction failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
