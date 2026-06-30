import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGateway } from "@/lib/ai/gateway";
import { RenegotiationSchema } from "@/lib/ai/schemas/renegotiation";
import { buildRenegotiationPrompt, RENEGOTIATION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/renegotiation";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { writeCommitmentBlocks } from "@/lib/services/calendar";
import { verifyAuth } from "@/lib/auth/authVerification";
import { 
  calculateRiskScore, 
  calculateProbability, 
  computeRiskTrend, 
  updateCommitmentRisk,
  computeStressScore,
  updateUserStressScore 
} from "@/lib/services/risk";
import { Commitment, User } from "@/lib/types";

async function recalculateCommitmentRisk(userId: string, commitmentId: string) {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  const commitmentDoc = await adminDb.collection("users").doc(userId).collection("commitments").doc(commitmentId).get();
  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments").get();
  
  if (userDoc.exists && commitmentDoc.exists) {
    const user = userDoc.data() as User;
    const commitment = commitmentDoc.data() as Commitment;
    
    const score = calculateRiskScore(commitment, user);
    const prob = calculateProbability(commitment, user);
    const trend = computeRiskTrend(score, commitment.riskScore || 0);
    await updateCommitmentRisk(userId, commitmentId, score, trend, prob);
    
    const allCommitments = commitmentsSnap.docs.map((doc: any) => doc.data() as Commitment);
    const stress = computeStressScore(allCommitments);
    await updateUserStressScore(userId, stress);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId, commitmentId, messages = [], confirm = false } = body;

    if (!userId || !commitmentId) {
      return NextResponse.json({ error: "Missing userId or commitmentId" }, { status: 400 });
    }

    // Verify authentication and ownership
    await verifyAuth(req, userId);

    // 1. Fetch commitment details
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

    // =========================================================================
    // Confirmation Flow
    // =========================================================================
    if (confirm) {
      console.log(`[renegotiate] Confirmation triggered for commitment: ${commitmentId}`);
      
      let scheduleToConfirm = body.proposedSchedule;
      let deadlineToConfirm = body.newDeadline;

      // Extract from message history if not directly provided in post body
      if (!scheduleToConfirm && messages.length > 0) {
        const latestAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        if (latestAssistant) {
          try {
            const parsed = JSON.parse(latestAssistant.content);
            scheduleToConfirm = parsed.proposedSchedule;
            deadlineToConfirm = parsed.newDeadline;
          } catch (e) {
            console.warn("[renegotiate] Failed to parse latest assistant message content as JSON:", e);
          }
        }
      }

      if (!scheduleToConfirm || !scheduleToConfirm.blocks || scheduleToConfirm.blocks.length === 0) {
        return NextResponse.json({ error: "No proposed schedule found to confirm" }, { status: 400 });
      }

      // Write work blocks to Google Calendar and Firestore
      console.log(`[renegotiate] Writing ${scheduleToConfirm.blocks.length} rescheduled blocks to Calendar...`);
      await writeCommitmentBlocks(userId, commitmentId, scheduleToConfirm.blocks);

      const updates: Record<string, any> = {
        isDirty: true
      };

      // If deadline changed, update it
      if (deadlineToConfirm) {
        updates.deadline = deadlineToConfirm;
      }

      // Add renegotiation entry to history
      const historyEntry = {
        timestamp: new Date(),
        previousDeadline: commitment.deadline || null,
        newDeadline: deadlineToConfirm || commitment.deadline || null,
        rescheduledBlocksCount: scheduleToConfirm.blocks.length,
        summary: scheduleToConfirm.summary || ""
      };
      updates.renegotiationHistory = FieldValue.arrayUnion(historyEntry);

      await adminDb
        .collection("users")
        .doc(userId)
        .collection("commitments")
        .doc(commitmentId)
        .update(updates);

      // Recalculate risk score and user stress score
      console.log("[renegotiate] Recalculating risk metrics...");
      await recalculateCommitmentRisk(userId, commitmentId);

      return NextResponse.json({ status: "confirmed", message: "Schedule updated." }, { status: 200 });
    }

    // =========================================================================
    // Conversation / Proposal Flow
    // =========================================================================
    // Extract latest user message and history
    const userMessages = messages.filter((m: any) => m.role === 'user');
    const userMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content : "";
    const history = messages.slice(0, messages.length - 1);

    console.log(`[renegotiate] Fetching fresh CoreLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "core");

    const prompt = buildRenegotiationPrompt(commitment as Commitment, context, history, userMessage);

    console.log("[renegotiate] Calling Gateway for renegotiation turn...");
    const rawResult = await callGateway<any>({
      systemInstruction: RENEGOTIATION_SYSTEM_INSTRUCTION,
      prompt,
      schema: RenegotiationSchema as any,
      endpointType: "renegotiation",
    });

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
    console.error("[renegotiate] Critical error in renegotiation:", msg);
    return NextResponse.json({ error: "Renegotiation failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
