import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { User } from "@/lib/types";
import { assembleCoreContext, assembleExtendedContext } from "./context";
import { CoreLifeContext, ExtendedLifeContext } from "../types/lifeContext";

const STALENESS_THRESHOLDS = {
  calendar: 30 * 60 * 1000,
  commitments: 5 * 60 * 1000,
  stressScore: 60 * 60 * 1000,
  learningCoefficients: 24 * 60 * 60 * 1000,
  reflection: 7 * 24 * 60 * 60 * 1000,
} as const;

async function refreshCalendarSlots(userId: string): Promise<void> {
  console.log(`[Freshness] refreshCalendarSlots called for user: ${userId}`);
  // Update timestamp in user document to indicate refresh occurred
  await adminDb.collection("users").doc(userId).update({
    calendarLastFetchedAt: Timestamp.now()
  });
}

async function recomputeStressScore(userId: string): Promise<void> {
  console.log(`[Freshness] recomputeStressScore called for user: ${userId}`);
  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("status", "in", ["active", "renegotiating"])
    .get();
  
  const count = commitmentsSnap.size;
  // Deterministic calculation: 15 points per active commitment, capped at 100
  const stressScore = Math.min(count * 15, 100);

  await adminDb.collection("users").doc(userId).update({
    "stats.stressScore": stressScore,
    "stats.stressScoreComputedAt": Timestamp.now()
  });
}

export async function ensureFreshContext(userId: string, tier: 'core'): Promise<CoreLifeContext>;
export async function ensureFreshContext(userId: string, tier: 'extended'): Promise<ExtendedLifeContext>;
export async function ensureFreshContext(
  userId: string,
  tier: 'core' | 'extended'
): Promise<CoreLifeContext | ExtendedLifeContext> {
  const userDoc = await adminDb.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    throw new Error(`User ${userId} not found`);
  }
  const user = userDoc.data() as User;
  const now = Date.now();

  // Refresh calendar if stale
  const lastFetched = ((user.calendarLastFetchedAt as any) instanceof Date)
    ? (user.calendarLastFetchedAt as any).getTime()
    : ((user.calendarLastFetchedAt as any)?.toDate?.()
      ? (user.calendarLastFetchedAt as any).toDate().getTime()
      : (typeof user.calendarLastFetchedAt === 'string'
        ? Date.parse(user.calendarLastFetchedAt)
        : 0));

  const calendarAge = now - lastFetched;
  if (calendarAge > STALENESS_THRESHOLDS.calendar) {
    await refreshCalendarSlots(userId);
  }

  // Refresh stress score if stale
  const lastComputed = ((user.stats?.stressScoreComputedAt as any) instanceof Date)
    ? (user.stats.stressScoreComputedAt as any).getTime()
    : ((user.stats?.stressScoreComputedAt as any)?.toDate?.()
      ? (user.stats.stressScoreComputedAt as any).toDate().getTime()
      : (typeof user.stats?.stressScoreComputedAt === 'string'
        ? Date.parse(user.stats.stressScoreComputedAt as any)
        : 0));

  const stressAge = now - lastComputed;
  if (stressAge > STALENESS_THRESHOLDS.stressScore) {
    await recomputeStressScore(userId);
  }

  // Return the fresh context of appropriate tier
  return tier === 'core'
    ? assembleCoreContext(userId)
    : assembleExtendedContext(userId);
}
