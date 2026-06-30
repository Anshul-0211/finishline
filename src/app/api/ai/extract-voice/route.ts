import { NextRequest, NextResponse } from "next/server";
import { callGateway } from "@/lib/ai/gateway";
import { commitmentDraftArraySchema } from "@/lib/ai/schemas/commitmentDraft";
import { buildExtractionPrompt, EXTRACTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/extraction";
import { verifyAuth } from "@/lib/auth/authVerification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const decoded = await verifyAuth(req);

    const body = await req.json();
    const { transcript, timezone = "UTC" } = body;

    const input = transcript;
    if (!input) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
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
    console.error("[extract-voice] AI extraction failed:", msg);
    return NextResponse.json({ error: "Extraction failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
