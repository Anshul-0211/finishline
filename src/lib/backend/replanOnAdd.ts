import { adminDb } from "../firebase/admin";
import { getCalendarFreeSlots, writeCalendarBlock } from "./calendar";
import { generateActionPlan } from "../ai/actions/generateActionPlan";
import { calculateRiskScore, calculateProbability } from "./riskEngine";
import { sendCollisionNotification } from "./notifications";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

interface CollisionAlert {
  type: "collision";
  commitmentAId: string;
  commitmentBId: string;
  commitmentATitle: string;
  commitmentBTitle: string;
  severity: "high";
  read: boolean;
  createdAt: any;
}

export interface ReplanResult {
  collisionsDetected: CollisionAlert[];
  actionPlanGenerated: boolean;
  calendarBlocksWritten: number;
  calendarSyncPending: boolean;
  affectedCommitmentIds: string[];
  newRiskScores: Record<string, number>;
}

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
  return Date.now();
}

export async function replanOnAdd(userId: string, newCommitmentId: string): Promise<ReplanResult> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  const user = { id: userId, ...userDoc.data() } as any;

  // 1. Generate Action Plan first (Step 5 of prompt)
  let actionPlanGenerated = false;
  let actionPlanResult: any = null;
  try {
    actionPlanResult = await generateActionPlan(userId, newCommitmentId);
    actionPlanGenerated = true;
  } catch (apErr) {
    console.error(`Failed to generate action plan during replanOnAdd for ${newCommitmentId}:`, apErr);
  }

  // Reload the new commitment document after action plan generation
  const newCommitmentRef = userRef.collection("commitments").doc(newCommitmentId);
  const newCommitmentDoc = await newCommitmentRef.get();
  const newCommitment = { id: newCommitmentId, ref: newCommitmentRef, ...newCommitmentDoc.data() } as any;

  // 2. Fetch calendar free slots
  let freeSlots: any[] = [];
  try {
    freeSlots = await getCalendarFreeSlots(userId, { days: 7 });
  } catch (calErr) {
    console.error(`Failed to fetch calendar free slots in replanOnAdd for user ${userId}:`, calErr);
  }

  // 3. Write up to 3 recommended work blocks
  const steps = actionPlanResult?.steps || [];
  const blocksToSchedule = steps.slice(0, 3);

  const writtenBlocks: any[] = [];
  const writtenSchedBlocks: any[] = [];
  let calendarBlocksWritten = 0;
  let calendarSyncPending = false;
  let calendarSyncError = "";

  const deadlineMs = newCommitment.deadline ? getMillis(newCommitment.deadline) : Infinity;

  for (const step of blocksToSchedule) {
    let startStr = "";
    let endStr = "";

    const suggestedTime = step.suggestedTimeSlot;
    if (
      suggestedTime &&
      new Date(suggestedTime).getTime() > Date.now() &&
      new Date(suggestedTime).getTime() + step.estimatedMinutes * 60 * 1000 <= deadlineMs
    ) {
      startStr = new Date(suggestedTime).toISOString();
      endStr = new Date(new Date(suggestedTime).getTime() + step.estimatedMinutes * 60 * 1000).toISOString();
    } else {
      // Find a slot in freeSlots that fits the duration and ends before the deadline
      const slotIndex = freeSlots.findIndex((slot) => {
        const slotStart = new Date(slot.start).getTime();
        const slotEnd = new Date(slot.end).getTime();
        const duration = (slotEnd - slotStart) / (60 * 1000);
        return (
          slotStart > Date.now() &&
          duration >= step.estimatedMinutes &&
          slotStart + step.estimatedMinutes * 60 * 1000 <= deadlineMs
        );
      });

      if (slotIndex !== -1) {
        const slot = freeSlots[slotIndex];
        const startMs = new Date(slot.start).getTime();
        startStr = new Date(startMs).toISOString();
        endStr = new Date(startMs + step.estimatedMinutes * 60 * 1000).toISOString();

        // Update the slot in freeSlots to avoid double allocation
        freeSlots[slotIndex] = {
          ...slot,
          start: endStr,
        };
      }
    }

    if (startStr && endStr) {
      if (calendarSyncPending) {
        // If we already failed to sync a block, mark subsequent blocks as pending as well
        writtenBlocks.push({
          title: step.title,
          start: startStr,
          end: endStr,
        });
      } else {
        try {
          const calendarEventId = await writeCalendarBlock(userId, {
            title: `${newCommitment.title} - ${step.title}`,
            start: startStr,
            end: endStr,
            commitmentId: newCommitmentId,
          });

          writtenBlocks.push({
            title: step.title,
            start: startStr,
            end: endStr,
            calendarEventId,
          });

          writtenSchedBlocks.push({
            start: startStr,
            end: endStr,
            calendarEventId,
          });

          calendarBlocksWritten++;
        } catch (calErr: any) {
          console.error(`Failed to write calendar block in replanOnAdd:`, calErr);
          calendarSyncPending = true;
          calendarSyncError = calErr.message || "Calendar write failed";

          writtenBlocks.push({
            title: step.title,
            start: startStr,
            end: endStr,
          });
        }
      }
    }
  }

  // Update new commitment document with calendar blocks
  await newCommitmentRef.update({
    calendarBlocks: writtenBlocks,
    scheduledBlocks: writtenSchedBlocks,
    calendarSyncStatus: calendarSyncPending ? "pending" : "synced",
    calendarSyncError,
    updatedAt: Timestamp.now(),
  });

  // Re-fetch all active commitments to evaluate risk and collisions
  const activeSnapshot = await userRef
    .collection("commitments")
    .where("status", "==", "active")
    .get();

  const allActiveCommitments: any[] = [];
  for (const doc of activeSnapshot.docs) {
    if (doc.id === newCommitmentId) {
      // Use the updated version
      allActiveCommitments.push({
        id: newCommitmentId,
        ref: newCommitmentRef,
        ...newCommitmentDoc.data(),
        calendarBlocks: writtenBlocks,
        scheduledBlocks: writtenSchedBlocks,
      });
    } else {
      allActiveCommitments.push({
        id: doc.id,
        ref: doc.ref,
        ...doc.data(),
      });
    }
  }

  const newRiskScores: Record<string, number> = {};
  const affectedCommitmentIds: string[] = [];
  const collisionsDetected: CollisionAlert[] = [];

  const underestimationFactor = user.learningCoefficients?.underestimationFactor || 1.0;

  // 4. Calculate/Update risk scores for all active commitments
  for (const commitment of allActiveCommitments) {
    const adjustedEffort = (commitment.effortEstimateHours || 0) * underestimationFactor;

    const populatedCommitment = {
      ...commitment,
      adjustedEffortHours: adjustedEffort,
      completionPercentage: commitment.completionPercentage || 0,
      completedEffortHours: commitment.completedEffortHours || 0,
      effortEstimateHours: commitment.effortEstimateHours || 0,
      scheduledBlocks: commitment.scheduledBlocks || [],
    };

    const newRisk = calculateRiskScore(populatedCommitment, user);
    const oldRisk = commitment.riskScore || 0;

    let riskTrend: "up" | "down" | "stable" = "stable";
    if (newRisk > oldRisk) riskTrend = "up";
    else if (newRisk < oldRisk) riskTrend = "down";

    const probs = calculateProbability(populatedCommitment, user, freeSlots.length);

    if (newRisk !== oldRisk || commitment.riskTrend !== riskTrend) {
      await commitment.ref.update({
        riskScore: newRisk,
        riskTrend,
        probabilityCurrentPath: probs.currentPath,
        probabilityRecommendedPath: probs.recommendedPath,
        adjustedEffortHours: adjustedEffort,
        updatedAt: Timestamp.now(),
      });
      newRiskScores[commitment.id] = newRisk;
      affectedCommitmentIds.push(commitment.id);
    } else {
      newRiskScores[commitment.id] = oldRisk;
    }
  }

  // 5. Detect and alert collisions
  const alertsRef = userRef.collection("alerts");
  const existingAlertsSnapshot = await alertsRef.where("type", "==", "collision").where("read", "==", false).get();
  const existingCollisionKeys = new Set(
    existingAlertsSnapshot.docs.map((d) => {
      const data = d.data();
      return [data.commitmentAId, data.commitmentBId].sort().join(":");
    })
  );

  const updatedNewCommitment = allActiveCommitments.find((c) => c.id === newCommitmentId);
  const newBlocks = updatedNewCommitment?.calendarBlocks || [];

  for (const commitment of allActiveCommitments) {
    if (commitment.id === newCommitmentId) continue;

    const otherBlocks = commitment.calendarBlocks || [];
    let hasOverlap = false;

    for (const nBlock of newBlocks) {
      const startA = getMillis(nBlock.start);
      const endA = getMillis(nBlock.end);

      for (const oBlock of otherBlocks) {
        const startB = getMillis(oBlock.start);
        const endB = getMillis(oBlock.end);

        if (startA < endB && startB < endA) {
          hasOverlap = true;
          break;
        }
      }
      if (hasOverlap) break;
    }

    if (hasOverlap) {
      const collisionKey = [newCommitmentId, commitment.id].sort().join(":");
      if (!existingCollisionKeys.has(collisionKey)) {
        const collisionData: CollisionAlert = {
          type: "collision",
          commitmentAId: newCommitmentId,
          commitmentBId: commitment.id,
          commitmentATitle: newCommitment.title,
          commitmentBTitle: commitment.title,
          severity: "high",
          read: false,
          createdAt: Timestamp.now(),
        };

        await alertsRef.add(collisionData);
        await sendCollisionNotification(userId, {
          commitmentA: { id: newCommitmentId, title: newCommitment.title },
          commitmentB: { id: commitment.id, title: commitment.title },
        });

        collisionsDetected.push(collisionData);
        existingCollisionKeys.add(collisionKey);
      }
    }
  }

  return {
    collisionsDetected,
    actionPlanGenerated,
    calendarBlocksWritten,
    calendarSyncPending,
    affectedCommitmentIds,
    newRiskScores,
  };
}
