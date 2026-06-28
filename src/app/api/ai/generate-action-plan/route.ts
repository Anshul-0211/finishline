import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGemini } from "@/lib/ai/gemini";
import { ActionPlanSchema } from "@/lib/ai/schemas/actionPlan";
import { buildActionPlanPrompt, ACTION_PLAN_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/actionPlan";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, commitmentId } = body;

    if (!userId || !commitmentId) {
      return NextResponse.json({ error: "Missing userId or commitmentId" }, { status: 400 });
    }

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

    // 2. Fetch the fresh CoreLifeContext
    console.log(`[generate-action-plan] Fetching fresh CoreLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "core");

    // 3. Build prompt and run Gemini call
    const prompt = buildActionPlanPrompt(commitment, context);

    console.log("[generate-action-plan] Calling Gemini for action plan generation...");
    const rawResult = await callGemini<any>({
      systemInstruction: ACTION_PLAN_SYSTEM_INSTRUCTION,
      prompt,
      schema: ActionPlanSchema as any,
      endpointType: "action-plan",
    });

    // 4. Enrich with confidence awareness metadata
    console.log("[generate-action-plan] Applying confidence awareness filters...");
    const enrichedResult = applyConfidenceAwareness(rawResult);

    // 5. Ensure confidenceLabel is present under aiMeta
    const finalResult = {
      ...enrichedResult,
      aiMeta: {
        ...enrichedResult.aiMeta,
        confidenceLabel: deriveConfidenceLabel(enrichedResult.aiMeta.confidence),
      },
    };

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[generate-action-plan] Critical error generating action plan:", msg);
    return NextResponse.json({ error: "Action plan generation failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
