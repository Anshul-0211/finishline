import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini";
import { buildExtractionPrompt } from "@/lib/ai/prompts/extraction";
import { commitmentDraftSchema } from "@/lib/ai/schemas/commitmentDraft";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const RequestSchema = z.object({
  transcript: z.string().min(1, "transcript is required"),
  userId: z.string().min(1, "userId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { transcript, userId } = parseResult.data;

    // Fetch user preferences/timezone
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const timezone = userData?.preferences?.timezone || "Asia/Kolkata";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

    const systemInstruction = `
You are FinishLine's Commitment Extractor. Analyze the text and extract the commitment details.
Input may be in English, Hindi, Hinglish (mixed Hindi-English), or any Indian language.
Interpret colloquial time references: 'kal' = tomorrow, 'aaj' = today, 'parso' = day after tomorrow.
Interpret effort: 'thoda sa' = 0.5h, 'bahut zyada' = 4h+.
    `.trim();

    const prompt = buildExtractionPrompt(transcript, todayStr, timezone);

    const extracted = await callGemini({
      systemInstruction,
      prompt,
      schema: commitmentDraftSchema,
      endpointType: "extraction",
    });

    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error("POST /api/ai/extract-voice error:", error);
    return NextResponse.json(
      { error: "EXTRACTION_FAILED", message: error.message || "Failed to extract commitment from voice" },
      { status: 422 }
    );
  }
}
