import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { callGemini } from "@/lib/ai/gemini";
import { buildRenegotiationPrompt } from "@/lib/ai/prompts/renegotiation";
import { renegotiationResponseSchema } from "@/lib/ai/schemas/renegotiation";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { applyConfidenceAwareness } from "@/lib/ai/confidence";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const RequestSchema = z.object({
  renegotiationId: z.string().min(1, "renegotiationId is required"),
  message: z.string().min(1, "message is required"),
  userId: z.string().min(1, "userId is required"),
  commitmentId: z.string().optional(), // only required on first turn
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { renegotiationId, message, userId, commitmentId } = parseResult.data;
    const now = Timestamp.now();

    const renegRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("renegotiations")
      .doc(renegotiationId);

    const renegDoc = await renegRef.get();
    let renegData = renegDoc.data();

    // 1. First turn: Create renegotiation document if it doesn't exist
    if (!renegDoc.exists) {
      if (!commitmentId) {
        return NextResponse.json(
          { error: "commitmentId is required on the first turn of renegotiation" },
          { status: 400 }
        );
      }

      const initialData = {
        commitmentId,
        messages: [],
        conversationHistory: [],
        status: "open",
        createdAt: now,
        updatedAt: now,
      };

      await renegRef.set(initialData);
      renegData = initialData;
    }

    // 2. Check if closed
    if (renegData?.status === "resolved" || renegData?.status === "abandoned") {
      return NextResponse.json({ error: "RENEGOTIATION_CLOSED" }, { status: 409 });
    }

    const currentCommitmentId = renegData?.commitmentId;

    // 3. Fetch commitment details
    const commitmentDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(currentCommitmentId)
      .get();

    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }
    const commitment = commitmentDoc.data() as any;

    // 4. Append user message
    const userMsg = {
      role: "user",
      content: message,
      timestamp: now,
    };

    const updatedMessages = [...(renegData?.messages || []), userMsg];

    // 5. Assemble core life context
    const context = await ensureFreshContext(userId, "core");

    // 6. Call renegotiation prompt builder
    const historyForPrompt = updatedMessages.map((m: any) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    const systemInstruction =
      "You are FinishLine's Empathetic AI Coach. Negotiate a new schedule when the user is struggling. If you propose a schedule, make sure it fits in the available gaps.";

    const prompt = buildRenegotiationPrompt(commitment, context, historyForPrompt, message);

    // 7. Invoke Gemini
    const renegResponse = await callGemini({
      systemInstruction,
      prompt,
      schema: renegotiationResponseSchema,
      endpointType: "renegotiation",
    });

    // 8. Apply confidence-awareness checking
    const enrichedResult = applyConfidenceAwareness(renegResponse);

    // 9. Append AI reply
    const assistantMsg = {
      role: "assistant",
      content: enrichedResult.message,
      timestamp: Timestamp.now(),
    };

    const nextMessages = [...updatedMessages, assistantMsg];

    // Update document
    const updates: any = {
      messages: nextMessages,
      conversationHistory: nextMessages,
      updatedAt: Timestamp.now(),
    };

    // If proposed schedule is present, store it with an expiration (24h)
    if (enrichedResult.hasProposedSchedule && enrichedResult.proposedSchedule) {
      const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      updates.proposedSchedule = {
        ...enrichedResult.proposedSchedule,
        expiresAt,
      };
      updates.proposedDeadline = enrichedResult.newDeadline
        ? Timestamp.fromDate(new Date(enrichedResult.newDeadline))
        : null;
    }

    await renegRef.update(updates);

    return NextResponse.json({
      reply: enrichedResult.message,
      proposedSchedule: enrichedResult.proposedSchedule,
      newDeadline: enrichedResult.newDeadline,
      done: enrichedResult.hasProposedSchedule,
      requiresUserReview: enrichedResult.requiresUserReview,
      reviewReason: enrichedResult.reviewReason,
    });
  } catch (error: any) {
    console.error("POST /api/ai/renegotiate error:", error);
    return NextResponse.json(
      { error: "RENEGOTIATION_FAILED", message: error.message || "Failed to process renegotiation turn" },
      { status: 500 }
    );
  }
}
