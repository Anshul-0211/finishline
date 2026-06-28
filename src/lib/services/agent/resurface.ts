import { adminDb } from "@/lib/firebase/admin";
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
 * Identifies dormant long-term goals not resurfaced for > 14 days and flags them.
 */
export async function processResurface(userId: string, commitments: Commitment[]): Promise<number> {
  const now = Date.now();
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  let resurfacedGoalsCount = 0;

  const activeGoals = commitments.filter(
    c => c.isLongTermGoal === true && (c.status === "active" || c.status === "renegotiating")
  );

  for (const g of activeGoals) {
    const lastResurfaced = getMillis(g.lastResurfacedAt);
    
    // Needs resurface if never resurfaced or last time was > 14 days ago
    if (lastResurfaced === 0 || lastResurfaced < fourteenDaysAgo) {
      await adminDb.collection("users").doc(userId).collection("commitments").doc(g.id).update({
        needsResurface: true
      });
      resurfacedGoalsCount++;
    }
  }

  return resurfacedGoalsCount;
}
