import { adminDb } from "@/lib/firebase/admin";
import { ensureFreshContext } from "../freshness";
import { buildActionPlanPrompt } from "../prompts/actionPlan";
import { actionPlanResponseSchema } from "../schemas/actionPlan";
import { callGemini } from "../gemini";
import { applyConfidenceAwareness } from "../confidence";
import { Timestamp } from "firebase-admin/firestore";

export async function generateActionPlan(userId: string, commitmentId: string) {
  // 1. Fetch commitment from Firestore
  const commitmentRef = adminDb
    .collection("users")
    .doc(userId)
    .collection("commitments")
    .doc(commitmentId);

  const commitmentDoc = await commitmentRef.get();
  if (!commitmentDoc.exists) {
    throw new Error(`Commitment ${commitmentId} not found`);
  }

  const commitmentData = commitmentDoc.data();
  if (!commitmentData) {
    throw new Error(`Commitment ${commitmentId} data is empty`);
  }

  // 2. Assemble core life context
  const context = await ensureFreshContext(userId, "core");

  // 3. Prepare the AI prompt and model configuration
  const systemInstruction =
    "You are FinishLine's Action Planner. Your job is to break down a commitment into actionable, sequenced work blocks and map them to available time slots.";
  const prompt = buildActionPlanPrompt(commitmentData as any, context);

  // 4. Invoke Gemini
  const response = await callGemini({
    systemInstruction,
    prompt,
    schema: actionPlanResponseSchema,
    endpointType: "action-plan",
  });

  // 5. Apply confidence-awareness checking
  const enrichedResult = applyConfidenceAwareness(response);

  // 6. Write action plan to Firestore commitment document
  const now = Timestamp.now();
  const updatedActionPlan = {
    steps: enrichedResult.steps.map((step) => ({
      ...step,
      completed: false,
      completedAt: null,
    })),
    generatedAt: now,
    aiMeta: enrichedResult.aiMeta,
  };

  await commitmentRef.update({
    actionPlan: updatedActionPlan,
    updatedAt: now,
  });

  return enrichedResult;
}
