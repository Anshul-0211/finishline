import { NextRequest, NextResponse } from "next/server";
import { callGemini } from "@/lib/ai/gemini";
import { buildFileExtractionPrompt } from "@/lib/ai/prompts/extraction";
import { commitmentDraftSchema } from "@/lib/ai/schemas/commitmentDraft";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const RequestSchema = z.object({
  fileUrl: z.string().url("fileUrl must be a valid URL"),
  mimeType: z.string().min(1, "mimeType is required"),
  userId: z.string().min(1, "userId is required"),
});

const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { fileUrl, mimeType, userId } = parseResult.data;

    if (!SUPPORTED_MIME_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: "Unsupported Media Type" }, { status: 415 });
    }

    // Fetch user preferences/timezone
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const userData = userDoc.data();
    const timezone = userData?.preferences?.timezone || "Asia/Kolkata";
    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

    // Fetch the file and convert to base64
    const fileResponse = await fetch(fileUrl);
    if (!fileResponse.ok) {
      return NextResponse.json(
        { error: "Failed to download file from storage" },
        { status: 400 }
      );
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const systemInstruction = buildFileExtractionPrompt(todayStr);

    const extracted = await callGemini({
      systemInstruction,
      prompt: "Analyze the attached document and extract all commitments into the required structured schema.",
      schema: z.array(commitmentDraftSchema),
      endpointType: "extraction",
      inlineData: {
        mimeType,
        data: base64Data,
      },
    });

    return NextResponse.json(extracted);
  } catch (error: any) {
    console.error("POST /api/ai/extract-file error:", error);
    return NextResponse.json(
      { error: "EXTRACTION_FAILED", message: error.message || "Failed to extract commitments from file" },
      { status: 422 }
    );
  }
}
