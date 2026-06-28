import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { User, Commitment } from "@/lib/types";

type DateInput = 
  | Date 
  | string 
  | number 
  | { toMillis: () => number } 
  | { toDate: () => Date } 
  | { _seconds: number; _nanoseconds?: number } 
  | { seconds: number; nanoseconds?: number }
  | null 
  | undefined;

// Helper to convert date inputs to millisecond epoch
function getMillis(val: DateInput): number {
  if (!val) return 0;
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === "number") {
    return val;
  }
  if (typeof val === "string") {
    return new Date(val).getTime();
  }
  if (typeof val === "object") {
    if ('toMillis' in val && typeof (val as { toMillis: unknown }).toMillis === "function") {
      return (val as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    const rawVal = val as Record<string, unknown>;
    if (typeof rawVal._seconds === "number") {
      return rawVal._seconds * 1000 + Math.floor((rawVal._nanoseconds as number || 0) / 1000000);
    }
    if (typeof rawVal.seconds === "number") {
      return rawVal.seconds * 1000 + Math.floor((rawVal.nanoseconds as number || 0) / 1000000);
    }
  }
  return 0;
}

/**
 * Returns true if the current time is within midnight ± 15 minutes.
 */
export function shouldRunPatternLearner(now: Date = new Date()): boolean {
  const hours = now.getHours();
  const minutes = now.getMinutes();
  return (hours === 0 && minutes <= 15) || (hours === 23 && minutes >= 45);
}

/**
 * Runs the daily Pattern Learner: updates user underestimation factor from recently completed commitments.
 */
export async function runPatternLearner(userId: string, user: User): Promise<boolean> {
  try {
    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Fetch commitments completed in the past 24 hours
    const snap = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .where("status", "==", "completed")
      .get();

    const completedRecently = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Commitment))
      .filter(c => getMillis(c.updatedAt) >= twentyFourHoursAgo);

    if (completedRecently.length === 0) {
      console.log(`[Pattern Learner] No commitments completed in the last 24h for user: ${userId}. Skipping update.`);
      return false;
    }

    let totalRatio = 0;
    let validCount = 0;

    for (const c of completedRecently) {
      // ratio = completedEffortHours / estimatedEffortHours
      const estimate = c.effortEstimateHours || 0;
      const actual = c.completedEffortHours || 0;

      if (estimate > 0 && actual > 0) {
        totalRatio += actual / estimate;
        validCount++;
      }
    }

    if (validCount === 0) {
      console.log(`[Pattern Learner] No commitments with valid hours for user: ${userId}. Skipping update.`);
      return false;
    }

    const avgRatio = totalRatio / validCount;
    const oldFactor = user.learningCoefficients?.underestimationFactor || 1.0;
    
    // Blend: 70% old factor, 30% new ratio (exponential moving average)
    const alpha = 0.3;
    let newFactor = alpha * avgRatio + (1 - alpha) * oldFactor;

    // Clamp between 0.5 and 3.0 to prevent outlier distortion
    newFactor = Math.max(0.5, Math.min(newFactor, 3.0));
    const roundedFactor = parseFloat(newFactor.toFixed(2));

    await adminDb.collection("users").doc(userId).update({
      "learningCoefficients.underestimationFactor": roundedFactor,
      "learningCoefficients.lastUpdated": FieldValue.serverTimestamp()
    });

    console.log(`[Pattern Learner] Updated underestimationFactor for user ${userId} from ${oldFactor} to ${roundedFactor} based on ${validCount} tasks.`);
    return true;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Pattern Learner] Error running pattern learner for user ${userId}: ${msg}`);
    return false;
  }
}
