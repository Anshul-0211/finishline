import { adminDb } from "@/lib/firebase/admin";
import { User, Commitment } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

/**
 * Helper to safely convert FirestoreDate (string, Date, Timestamp, or custom object) to a JS Date.
 */
function parseFirestoreDate(val: any): Date | null {
  if (!val) return null;
  if (typeof val.toDate === "function") {
    return val.toDate();
  }
  if (val instanceof Date) {
    return val;
  }
  if (typeof val === "string") {
    const parsed = new Date(val);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  if (val && typeof val === "object" && typeof val.seconds === "number") {
    return new Date(val.seconds * 1000);
  }
  return null;
}

/**
 * Evaluates whether a user is at risk of burnout and updates their stats in Firestore.
 * 
 * Burnout is flagged as true if:
 * 1. User's current stress score exceeds 75.
 * 2. AND/OR the user has more than 2 renegotiation history entries logged in their commitments within the past 7 days.
 */
export async function processBurnout(user: User, commitments: Commitment[]): Promise<boolean> {
  const stressThreshold = 75;
  const renegotiationThreshold = 2;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  console.log(`[Burnout Service] Evaluating burnout for user ${user.uid}...`);

  // 1. Stress Score check
  const currentStress = user.stats?.stressScore || 0;
  const hasHighStress = currentStress > stressThreshold;

  // 2. Renegotiation history check
  let recentRenegotiationCount = 0;
  if (Array.isArray(commitments)) {
    for (const commitment of commitments) {
      if (Array.isArray(commitment.renegotiationHistory)) {
        for (const entry of commitment.renegotiationHistory) {
          const entryDate = parseFirestoreDate(entry.at);
          if (entryDate && entryDate >= sevenDaysAgo) {
            recentRenegotiationCount++;
          }
        }
      }
    }
  }

  const isBurnoutDetected = hasHighStress || recentRenegotiationCount > renegotiationThreshold;

  console.log(
    `[Burnout Service] User ${user.uid} stats - Stress Score: ${currentStress} (Threshold: >${stressThreshold}), ` +
    `Recent Renegotiations: ${recentRenegotiationCount} (Threshold: >${renegotiationThreshold}). ` +
    `Result - Burnout Detected: ${isBurnoutDetected}`
  );

  // 3. Write update to Firestore
  const userRef = adminDb.collection("users").doc(user.uid);
  await userRef.update({
    "stats.burnoutDetected": isBurnoutDetected,
    "stats.burnoutLastEvaluatedAt": FieldValue.serverTimestamp()
  });

  return isBurnoutDetected;
}
