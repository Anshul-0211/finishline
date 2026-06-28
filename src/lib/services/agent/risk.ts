import { User, Commitment } from "@/lib/types";
import {
  calculateRiskScore,
  calculateProbability,
  computeRiskTrend,
  computeStressScore,
  updateCommitmentRisk,
  updateUserStressScore
} from "../risk";

export interface RiskProcessResult {
  commitmentsProcessed: number;
  errors: string[];
}

/**
 * Processes risk scoring and stress score calculations for a user and their commitments.
 */
export async function processUserRisk(user: User, commitments: Commitment[]): Promise<RiskProcessResult> {
  let commitmentsProcessed = 0;
  const errors: string[] = [];

  const updatedCommitments = await Promise.all(
    commitments.map(async (c) => {
      try {
        const riskScore = calculateRiskScore(c, user);
        const probability = calculateProbability(c, user);
        const riskTrend = computeRiskTrend(riskScore, c.riskScore || 0);

        await updateCommitmentRisk(user.uid, c.id, riskScore, riskTrend, probability);
        commitmentsProcessed++;

        // Return a modified copy of the commitment with updated risk score for stress calculation
        return {
          ...c,
          riskScore
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Failed to process commitment ${c.id} for user ${user.uid}: ${msg}`);
        return c;
      }
    })
  );

  try {
    const stressScore = computeStressScore(updatedCommitments);
    await updateUserStressScore(user.uid, stressScore);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Failed to update stress score for user ${user.uid}: ${msg}`);
  }

  return {
    commitmentsProcessed,
    errors
  };
}
