import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { calculateRiskScore } from "@/lib/backend/riskEngine";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const BodySchema = z.object({
  progressPercent: z.number().min(0).max(100),
  note: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: RouteContext) {
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

    const { progressPercent, note } = result.data;
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

    // 3. Create check-in history entry
    const checkInEntry = {
      at: now,
      timestamp: now,
      progressPercent,
      completionAtCheckIn: progressPercent,
      note: note || "",
      wasOnTrack: true,
      failureReason: null,
    };

    // Prepare updated object for risk calculation
    const updatedCommitmentForRisk = {
      ...commitment,
      progressPercent,
      completionPercentage: progressPercent,
      lastCheckInAt: now,
      checkInHistory: [...(commitment.checkInHistory || []), checkInEntry],
    };

    // Recalculate risk score
    const newRiskScore = calculateRiskScore(updatedCommitmentForRisk, user);
    const oldRiskScore = commitment.riskScore || 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (newRiskScore > oldRiskScore) trend = "up";
    else if (newRiskScore < oldRiskScore) trend = "down";

    // 4. Save to Firestore
    await commitmentRef.update({
      progressPercent,
      completionPercentage: progressPercent,
      lastCheckInAt: now,
      checkInHistory: FieldValue.arrayUnion(checkInEntry),
      riskScore: newRiskScore,
      riskTrend: trend,
      updatedAt: now,
    });

    return NextResponse.json({
      newRiskScore,
      trend,
    });
  } catch (error: any) {
    console.error("POST /api/commitments/[id]/checkin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit check-in" },
      { status: 500 }
    );
  }
}
