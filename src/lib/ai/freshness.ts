import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { assembleCoreContext, assembleExtendedContext } from "./context";
import { CoreLifeContext, ExtendedLifeContext } from "./types";

const STALENESS_THRESHOLDS = {
  calendar: 30 * 60 * 1000,          // 30 minutes
  commitments: 5 * 60 * 1000,        // 5 minutes
  stressScore: 60 * 60 * 1000,       // 1 hour
  learningCoefficients: 24 * 60 * 60 * 1000,  // 24 hours
} as const;

async function refreshCalendarSlots(userId: string): Promise<void> {
  // Update timestamp in user document to indicate refresh occurred
  await adminDb.collection("users").doc(userId).update({
    calendarLastFetchedAt: Timestamp.now()
  });
}

async function recomputeStressScore(userId: string): Promise<void> {
  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("status", "==", "active")
    .get();
  
  const count = commitmentsSnap.size;
  // Deterministic calculation: 15 points per active commitment, capped at 100
  const stressScore = Math.min(count * 15, 100);

  await adminDb.collection("users").doc(userId).update({
    "stats.stressScore": stressScore,
    "stats.stressScoreComputedAt": Timestamp.now()
  });
}

export async function ensureFreshContext(
  userId: string,
  tier: 'core' | 'extended'
): Promise<CoreLifeContext | ExtendedLifeContext> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  const user = userDoc.data() as any;
  const now = Date.now();

  // Refresh calendar if stale
  const lastFetched = user.calendarLastFetchedAt?.toDate?.()?.getTime() || 0;
  const calendarAge = now - lastFetched;
  if (calendarAge > STALENESS_THRESHOLDS.calendar) {
    await refreshCalendarSlots(userId);
  }

  // Refresh stress score if stale
  const lastComputed = user.stats?.stressScoreComputedAt?.toDate?.()?.getTime() || 0;
  const stressAge = now - lastComputed;
  if (stressAge > STALENESS_THRESHOLDS.stressScore) {
    await recomputeStressScore(userId);
  }

  // Return the fresh context of appropriate tier
  return tier === 'core'
    ? assembleCoreContext(userId)
    : assembleExtendedContext(userId);
}
