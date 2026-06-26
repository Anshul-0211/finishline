import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    // Auth Check
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET environment variable is not configured.");
      return NextResponse.json({ error: "Configuration error" }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = Timestamp.now();
    const sevenDaysAgo = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Fetch commitments completed in the past 7 days
    const completedSnapshot = await adminDb
      .collectionGroup("commitments")
      .where("status", "==", "completed")
      .where("completedAt", ">=", sevenDaysAgo)
      .get();

    const userCompletedMap: Record<string, any[]> = {};
    for (const doc of completedSnapshot.docs) {
      const parentUserDoc = doc.ref.parent.parent;
      if (parentUserDoc) {
        const userId = parentUserDoc.id;
        if (!userCompletedMap[userId]) {
          userCompletedMap[userId] = [];
        }
        userCompletedMap[userId].push(doc.data());
      }
    }

    // Get all users who have active commitments to update their stress scores
    const activeSnapshot = await adminDb
      .collectionGroup("commitments")
      .where("status", "==", "active")
      .get();

    const userActiveMap: Record<string, any[]> = {};
    for (const doc of activeSnapshot.docs) {
      const parentUserDoc = doc.ref.parent.parent;
      if (parentUserDoc) {
        const userId = parentUserDoc.id;
        if (!userActiveMap[userId]) {
          userActiveMap[userId] = [];
        }
        userActiveMap[userId].push(doc.data());
      }
    }

    // List of all users to update
    const allUserIds = Array.from(new Set([...Object.keys(userCompletedMap), ...Object.keys(userActiveMap)]));
    let usersUpdated = 0;
    let coefficientsUpdated = 0;

    const priorityWeight: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    for (const userId of allUserIds) {
      const userRef = adminDb.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) continue;

      const updates: any = {};
      let updatedCoefficients = false;

      // 1. Calculate underestimation factor if there are completed commitments
      const completedCommitments = userCompletedMap[userId] || [];
      const dataPoints: number[] = [];

      for (const commitment of completedCommitments) {
        const estimated = commitment.effortEstimateHours;
        const actual =
          commitment.actualEffortHours !== undefined
            ? commitment.actualEffortHours
            : commitment.actualEffort !== undefined
            ? commitment.actualEffort
            : commitment.completedEffortHours;

        if (estimated > 0 && actual > 0) {
          dataPoints.push(actual / estimated);
        }
      }

      if (dataPoints.length >= 3) {
        const sumFactors = dataPoints.reduce((sum, val) => sum + val, 0);
        const avgFactor = sumFactors / dataPoints.length;
        // Clamp between 0.8 and 2.5
        const clampedFactor = Math.max(0.8, Math.min(2.5, avgFactor));

        updates["learningCoefficients.underestimationFactor"] = clampedFactor;
        updates["learningCoefficients.lastUpdated"] = now;
        updatedCoefficients = true;
        coefficientsUpdated++;
      }

      // 2. Calculate stress score
      const activeCommitments = userActiveMap[userId] || [];
      const activeCount = activeCommitments.length;

      let newStressScore = 0;
      if (activeCount > 0) {
        const weightedSum = activeCommitments.reduce((sum, c) => {
          const risk = c.riskScore || 0;
          const p = c.priority || "medium";
          const weight = priorityWeight[p] || 2;
          return sum + risk * weight;
        }, 0);

        const avgStress = weightedSum / activeCount;
        newStressScore = Math.min(100, Math.round(avgStress));
      }

      updates["stats.stressScore"] = newStressScore;
      updates["stats.stressScoreComputedAt"] = now;
      updates["updatedAt"] = now;

      await userRef.update(updates);
      usersUpdated++;
    }

    return NextResponse.json({
      success: true,
      usersUpdated,
      coefficientsUpdated,
    });
  } catch (error: any) {
    console.error("Agent learn failure:", error);
    return NextResponse.json(
      { error: error.message || "Agent learning failed" },
      { status: 500 }
    );
  }
}
