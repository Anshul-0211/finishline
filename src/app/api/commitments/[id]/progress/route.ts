import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { calculateRiskScore, calculateProbability } from "@/lib/backend/riskEngine";
import { getCalendarFreeSlots } from "@/lib/backend/calendar";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const BodySchema = z.object({
  stepIndex: z.number().int().nonnegative(),
  completed: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const userId = req.cookies.get("session")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = BodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { stepIndex, completed } = result.data;
    const now = Timestamp.now();

    // 1. Fetch user doc
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = { id: userId, ...userDoc.data() } as any;

    // 2. Fetch commitment doc
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(id);

    const commitmentDoc = await commitmentRef.get();
    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const commitment = commitmentDoc.data() as any;
    const actionPlan = commitment.actionPlan;

    if (!actionPlan || !Array.isArray(actionPlan.steps)) {
      return NextResponse.json({ error: "Action plan not found or invalid" }, { status: 400 });
    }

    const steps = [...actionPlan.steps];
    if (stepIndex >= steps.length) {
      return NextResponse.json({ error: "Step index out of bounds" }, { status: 400 });
    }

    // Update the specific step
    steps[stepIndex] = {
      ...steps[stepIndex],
      completed,
      completedAt: completed ? now : null,
    };

    // Calculate progress percentage
    const completedCount = steps.filter((s: any) => s.completed).length;
    const progressPercent = Math.round((completedCount / steps.length) * 100);

    // Prepare updated object for risk calculation
    const updatedActionPlan = {
      ...actionPlan,
      steps,
    };

    const updatedCommitmentForRisk = {
      ...commitment,
      actionPlan: updatedActionPlan,
      progressPercent,
      completionPercentage: progressPercent,
    };

    // Recalculate risk score and probabilities
    let freeSlots: any[] = [];
    try {
      freeSlots = await getCalendarFreeSlots(userId, { days: 7 });
    } catch (calErr) {
      console.error(`Calendar fetch failed during progress update:`, calErr);
    }

    const newRiskScore = calculateRiskScore(updatedCommitmentForRisk, user);
    const oldRiskScore = commitment.riskScore || 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (newRiskScore > oldRiskScore) trend = "up";
    else if (newRiskScore < oldRiskScore) trend = "down";

    const probs = calculateProbability(updatedCommitmentForRisk, user, freeSlots.length);

    // Update Firestore
    await commitmentRef.update({
      actionPlan: updatedActionPlan,
      progressPercent,
      completionPercentage: progressPercent,
      riskScore: newRiskScore,
      riskTrend: trend,
      probabilityCurrentPath: probs.currentPath,
      probabilityRecommendedPath: probs.recommendedPath,
      updatedAt: now,
    });

    return NextResponse.json({ progressPercent });
  } catch (error: any) {
    console.error("PATCH /api/commitments/[id]/progress error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update step progress" },
      { status: 500 }
    );
  }
}
