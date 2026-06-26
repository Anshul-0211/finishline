import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCalendarFreeSlots, writeCalendarBlock } from "@/lib/backend/calendar";
import { calculateRiskScore, calculateProbability } from "@/lib/backend/riskEngine";
import { sendCheckInNotification, sendCollisionNotification } from "@/lib/backend/notifications";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

function getMillis(val: any): number {
  if (!val) return Date.now();
  if (typeof val.toMillis === "function") {
    return val.toMillis();
  }
  if (typeof val.toDate === "function") {
    return val.toDate().getTime();
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === "number") {
    return val;
  }
  if (typeof val === "string") {
    return new Date(val).getTime();
  }
  if (typeof val._seconds === "number") {
    return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1000000);
  }
  if (typeof val.seconds === "number") {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  return Date.now();
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
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

    // Step 1: Scan active commitments
    const commitmentsSnapshot = await adminDb
      .collectionGroup("commitments")
      .where("status", "==", "active")
      .get();

    const userCommitmentsMap: Record<string, any[]> = {};
    for (const doc of commitmentsSnapshot.docs) {
      const parentUserDoc = doc.ref.parent.parent;
      if (parentUserDoc) {
        const userId = parentUserDoc.id;
        if (!userCommitmentsMap[userId]) {
          userCommitmentsMap[userId] = [];
        }
        userCommitmentsMap[userId].push({
          id: doc.id,
          ref: doc.ref,
          ...doc.data(),
        });
      }
    }

    const userIds = Object.keys(userCommitmentsMap);
    if (userIds.length === 0) {
      return NextResponse.json({
        success: true,
        usersProcessed: 0,
        totalCommitmentsScanned: 0,
        errors: [],
      });
    }

    // Fetch user details for these users
    const userDocs = await Promise.all(
      userIds.map((uid) => adminDb.collection("users").doc(uid).get())
    );
    const usersMap: Record<string, any> = {};
    for (const doc of userDocs) {
      if (doc.exists) {
        usersMap[doc.id] = { id: doc.id, ...doc.data() };
      }
    }

    const globalErrors: string[] = [];
    let totalCommitmentsScanned = 0;
    let usersProcessed = 0;

    for (const userId of userIds) {
      const user = usersMap[userId];
      if (!user) continue;

      const userCommitments = userCommitmentsMap[userId];
      totalCommitmentsScanned += userCommitments.length;
      usersProcessed++;

      const now = Timestamp.now();
      const nowMs = now.toMillis();

      let risksUpdated = 0;
      let collisionsDetected = 0;
      let checkInsSent = 0;
      let calendarWritesExecuted = 0;
      const userErrors: string[] = [];

      // Step 2: Refresh calendar slots + retry pending syncs
      let freeSlots: any[] = [];
      try {
        freeSlots = await getCalendarFreeSlots(userId, { days: 7 });
      } catch (calErr: any) {
        console.error(`Calendar fetch failed for user ${userId}:`, calErr);
        userErrors.push(`Calendar Unavailable: ${calErr.message}`);
        // Proceed with empty free slots
      }

      // Retry pending calendar syncs
      for (const commitment of userCommitments) {
        if (commitment.calendarSyncStatus === "pending") {
          try {
            const blocks = commitment.calendarBlocks || [];
            const updatedBlocks = [];
            const updatedSchedBlocks = [];
            let syncFailed = false;

            for (const block of blocks) {
              if (!block.calendarEventId) {
                try {
                  const calendarEventId = await writeCalendarBlock(userId, {
                    title: block.title || commitment.title,
                    start: block.start,
                    end: block.end,
                    commitmentId: commitment.id,
                  });
                  updatedBlocks.push({ ...block, calendarEventId });
                  updatedSchedBlocks.push({
                    start: block.start,
                    end: block.end,
                    calendarEventId,
                  });
                  calendarWritesExecuted++;
                } catch (writeErr: any) {
                  console.error(`Calendar retry write failed for block:`, writeErr);
                  syncFailed = true;
                  updatedBlocks.push(block); // keep without ID
                  break;
                }
              } else {
                updatedBlocks.push(block);
                updatedSchedBlocks.push({
                  start: block.start,
                  end: block.end,
                  calendarEventId: block.calendarEventId,
                });
              }
            }

            if (!syncFailed) {
              await commitment.ref.update({
                calendarBlocks: updatedBlocks,
                scheduledBlocks: updatedSchedBlocks,
                calendarSyncStatus: "synced",
                calendarSyncError: "",
                updatedAt: now,
              });
              // update local representation
              commitment.calendarBlocks = updatedBlocks;
              commitment.scheduledBlocks = updatedSchedBlocks;
              commitment.calendarSyncStatus = "synced";
            }
          } catch (retryErr: any) {
            console.error(`Calendar sync retry failed for commitment ${commitment.id}:`, retryErr);
          }
        }
      }

      // Step 3: Risk calculations
      for (const commitment of userCommitments) {
        const factor = user.learningCoefficients?.underestimationFactor || 1.0;
        const adjustedEffort = (commitment.effortEstimateHours || 0) * factor;

        // Populate required properties for calculateRiskScore / calculateProbability
        const populatedCommitment: any = {
          ...commitment,
          adjustedEffortHours: adjustedEffort,
          completionPercentage: commitment.completionPercentage || 0,
          completedEffortHours: commitment.completedEffortHours || 0,
          effortEstimateHours: commitment.effortEstimateHours || 0,
          scheduledBlocks: commitment.scheduledBlocks || [],
        };

        const newRiskScore = calculateRiskScore(populatedCommitment, user);
        const oldRiskScore = commitment.riskScore || 0;

        let riskTrend: "up" | "down" | "stable" = "stable";
        if (newRiskScore > oldRiskScore) riskTrend = "up";
        else if (newRiskScore < oldRiskScore) riskTrend = "down";

        const probs = calculateProbability(populatedCommitment, user, freeSlots.length);

        if (
          newRiskScore !== oldRiskScore ||
          commitment.probabilityCurrentPath !== probs.currentPath ||
          commitment.probabilityRecommendedPath !== probs.recommendedPath ||
          commitment.riskTrend !== riskTrend
        ) {
          await commitment.ref.update({
            riskScore: newRiskScore,
            riskTrend,
            probabilityCurrentPath: probs.currentPath,
            probabilityRecommendedPath: probs.recommendedPath,
            adjustedEffortHours: adjustedEffort,
            updatedAt: now,
          });

          // Update local copy for subsequent checks in this loop
          commitment.riskScore = newRiskScore;
          commitment.riskTrend = riskTrend;
          commitment.probabilityCurrentPath = probs.currentPath;
          commitment.probabilityRecommendedPath = probs.recommendedPath;
          risksUpdated++;
        }
      }

      // Step 4: Detect collisions
      const alertsRef = adminDb.collection("users").doc(userId).collection("alerts");
      const existingAlertsSnapshot = await alertsRef.where("type", "==", "collision").where("read", "==", false).get();
      const existingCollisionKeys = new Set(
        existingAlertsSnapshot.docs.map((d) => {
          const data = d.data();
          return [data.commitmentAId, data.commitmentBId].sort().join(":");
        })
      );

      for (let i = 0; i < userCommitments.length; i++) {
        const commitmentA = userCommitments[i];
        const blocksA = commitmentA.calendarBlocks || [];

        for (let j = i + 1; j < userCommitments.length; j++) {
          const commitmentB = userCommitments[j];
          const blocksB = commitmentB.calendarBlocks || [];

          let hasOverlap = false;
          for (const blockA of blocksA) {
            const startA = getMillis(blockA.start);
            const endA = getMillis(blockA.end);

            for (const blockB of blocksB) {
              const startB = getMillis(blockB.start);
              const endB = getMillis(blockB.end);

              if (startA < endB && startB < endA) {
                hasOverlap = true;
                break;
              }
            }
            if (hasOverlap) break;
          }

          if (hasOverlap) {
            const collisionKey = [commitmentA.id, commitmentB.id].sort().join(":");
            if (!existingCollisionKeys.has(collisionKey)) {
              await alertsRef.add({
                type: "collision",
                commitmentAId: commitmentA.id,
                commitmentBId: commitmentB.id,
                commitmentATitle: commitmentA.title,
                commitmentBTitle: commitmentB.title,
                severity: "high",
                read: false,
                createdAt: now,
              });
              await sendCollisionNotification(userId, {
                commitmentA: { id: commitmentA.id, title: commitmentA.title },
                commitmentB: { id: commitmentB.id, title: commitmentB.title },
              });
              collisionsDetected++;
              existingCollisionKeys.add(collisionKey);
            }
          }
        }
      }

      // Step 5: Check-in notifications
      for (const commitment of userCommitments) {
        const riskScore = commitment.riskScore || 0;
        const nextCheckIn = commitment.nextCheckInAt ? getMillis(commitment.nextCheckInAt) : null;

        if (riskScore > 70 && (nextCheckIn === null || nextCheckIn <= nowMs)) {
          await sendCheckInNotification(userId, {
            id: commitment.id,
            title: commitment.title,
            riskScore,
          });

          const checkInIntervalHours = riskScore > 85 ? 4 : 8;
          const nextCheckInTimestamp = Timestamp.fromMillis(nowMs + checkInIntervalHours * 60 * 60 * 1000);

          await commitment.ref.update({
            nextCheckInAt: nextCheckInTimestamp,
            updatedAt: now,
          });

          checkInsSent++;
        }
      }

      // Step 6: Goal resurfacing
      const resurfaceRef = adminDb.collection("users").doc(userId).collection("resurface");
      for (const commitment of userCommitments) {
        const hasNoDeadline = !commitment.deadline;
        const lastUpdatedMs = getMillis(commitment.updatedAt || commitment.createdAt);
        const daysSinceUpdate = (nowMs - lastUpdatedMs) / (24 * 60 * 60 * 1000);

        if (hasNoDeadline && daysSinceUpdate > 7) {
          // Check if already resurfaced
          const existResurface = await resurfaceRef.where("commitmentId", "==", commitment.id).get();
          if (existResurface.empty) {
            await resurfaceRef.add({
              commitmentId: commitment.id,
              title: commitment.title,
              daysSinceUpdate: Math.round(daysSinceUpdate),
              createdAt: now,
            });
          }
        }
      }

      // Step 7: Write AgentLog
      const agentLogsRef = adminDb.collection("users").doc(userId).collection("agentLogs");
      await agentLogsRef.add({
        runAt: now,
        commitmentCount: userCommitments.length,
        risksUpdated,
        collisionsDetected,
        checkInsSent,
        calendarWritesExecuted,
        durationMs: Date.now() - startTime,
        status: userErrors.length === 0 ? "success" : "partial",
        errors: userErrors,
      });

      if (userErrors.length > 0) {
        globalErrors.push(...userErrors.map((err) => `User ${userId}: ${err}`));
      }
    }

    return NextResponse.json({
      success: true,
      usersProcessed,
      totalCommitmentsScanned,
      errors: globalErrors,
    });
  } catch (error: any) {
    console.error("Agent run critical failure:", error);
    return NextResponse.json(
      { error: error.message || "Agent loop failed" },
      { status: 500 }
    );
  }
}
