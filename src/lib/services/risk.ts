import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { Commitment, User } from "@/lib/types";
import {
  calculateRiskScore,
  calculateProbability,
  computeRiskTrend,
  computeStressScore
} from "../utils/risk";

export {
  calculateRiskScore,
  calculateProbability,
  computeRiskTrend,
  computeStressScore
};

/**
 * Updates a commitment document with new risk metrics.
 */
export async function updateCommitmentRisk(
  userId: string,
  commitmentId: string,
  riskScore: number,
  riskTrend: 'improving' | 'stable' | 'worsening',
  probability: number
): Promise<void> {
  await adminDb.collection("users").doc(userId).collection("commitments").doc(commitmentId).update({
    riskScore,
    riskTrend,
    probability,
    riskUpdatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Updates the user's stress score stats.
 */
export async function updateUserStressScore(userId: string, stressScore: number): Promise<void> {
  await adminDb.collection("users").doc(userId).update({
    'stats.stressScore': stressScore,
    'stats.stressScoreComputedAt': FieldValue.serverTimestamp(),
  });
}
