import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGateway } from "@/lib/ai/gateway";
import { ReplanOnAddSchema } from "@/lib/ai/schemas/replanOnAdd";
import { buildReplanOnAddPrompt, REPLAN_ON_ADD_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/replanOnAdd";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { CoreLifeContext } from "@/lib/ai/types";
import { verifyAuth } from "@/lib/auth/authVerification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, newCommitmentId, proposedBlocks } = body;

    if (!userId || !newCommitmentId || !proposedBlocks || !Array.isArray(proposedBlocks)) {
      return NextResponse.json(
        { error: "Missing required parameters: userId, newCommitmentId, proposedBlocks" },
        { status: 400 }
      );
    }

    // Verify authentication and ownership
    await verifyAuth(req, userId);

    // 1. Fetch the new commitment details from Firestore
    console.log(`[replan-on-add] Fetching commitment details: ${newCommitmentId} for user: ${userId}...`);
    const commitmentDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(newCommitmentId)
      .get();

    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: "New commitment not found" }, { status: 404 });
    }
    const newCommitment = commitmentDoc.data();

    // 2. Fetch Core Life Context
    console.log(`[replan-on-add] Assembling fresh CoreLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "core");

    // 3. Build Prompt
    const prompt = buildReplanOnAddPrompt(newCommitment, proposedBlocks, context as CoreLifeContext);

    // 4. Invoke AI Gateway
    console.log("[replan-on-add] Calling AI Gateway...");
    const rawResult = await callGateway<any>({
      systemInstruction: REPLAN_ON_ADD_SYSTEM_INSTRUCTION,
      prompt,
      schema: ReplanOnAddSchema as any,
      endpointType: "action-plan", // Maps to the action-plan budget & temperature
    });

    // 5. Enrich with confidence metadata
    const enrichedResult = applyConfidenceAwareness(rawResult);
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
    console.error("[replan-on-add] Critical error during replan calculations:", msg);
    return NextResponse.json({ error: "Dynamic replanning failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
