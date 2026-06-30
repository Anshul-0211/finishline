import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callGateway } from "@/lib/ai/gateway";
import { RiskExplanationSchema } from "@/lib/ai/schemas/riskExplanation";
import { buildRiskExplanationPrompt, RISK_EXPLANATION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/riskExplanation";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { Commitment } from "@/lib/types";
import { verifyAuth } from "@/lib/auth/authVerification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, commitmentId } = body;

    if (!userId || !commitmentId) {
      return NextResponse.json({ error: "Missing userId or commitmentId" }, { status: 400 });
    }

    // Verify authentication and ownership
    await verifyAuth(req, userId);

    // 1. Fetch the commitment details from Firestore
    const commitmentDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId)
      .get();

    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: `Commitment ${commitmentId} not found` }, { status: 400 });
    }

    const commitment = commitmentDoc.data()!;
    const riskScore = commitment.riskScore || 0;

    // 2. Build prompt using only commitment details (Core subset)
    const prompt = buildRiskExplanationPrompt(commitment as Commitment, riskScore);

    console.log("[explain-risk] Calling Gateway for risk explanation...");
    const rawResult = await callGateway<any>({
      systemInstruction: RISK_EXPLANATION_SYSTEM_INSTRUCTION,
      prompt,
      schema: RiskExplanationSchema as any,
      endpointType: "explanation",
    });

    // 3. Enrich with confidence metadata
    const enrichedResult = applyConfidenceAwareness(rawResult);

    // 4. Ensure confidenceLabel is present under aiMeta
    const finalResult = {
      ...enrichedResult,
      aiMeta: {
        ...enrichedResult.aiMeta,
        confidenceLabel: deriveConfidenceLabel(enrichedResult.aiMeta.confidence),
      },
    };

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[explain-risk] Critical error explaining risk:", msg);
    return NextResponse.json({ error: "Risk explanation failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
