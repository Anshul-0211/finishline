import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callGemini } from "@/lib/ai/gemini";
import { buildRiskExplanationPrompt } from "@/lib/ai/prompts/riskExplanation";
import { riskExplanationResponseSchema } from "@/lib/ai/schemas/riskExplanation";
import { applyConfidenceAwareness } from "@/lib/ai/confidence";
import { z } from "zod";

const RequestSchema = z.object({
  commitmentId: z.string().min(1, "commitmentId is required"),
  userId: z.string().min(1, "userId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { commitmentId, userId } = parseResult.data;

    // Fetch commitment from Firestore
    const doc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const commitment = doc.data() as any;
    const riskScore = commitment.riskScore || 0;

    const systemInstruction =
      "You are FinishLine's Risk Analyst. Explain the risk score calculation in plain English, highlighting the primary driver and suggesting an actionable mitigation strategy.";

    const prompt = buildRiskExplanationPrompt(commitment, riskScore);

    const explanation = await callGemini({
      systemInstruction,
      prompt,
      schema: riskExplanationResponseSchema,
      endpointType: "explanation",
    });

    const enrichedResult = applyConfidenceAwareness(explanation);
    return NextResponse.json(enrichedResult);
  } catch (error: any) {
    console.error("POST /api/ai/explain-risk error:", error);
    return NextResponse.json(
      { error: "EXPLANATION_FAILED", message: error.message || "Failed to explain risk score" },
      { status: 500 }
    );
  }
}
