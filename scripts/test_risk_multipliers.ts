import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { User, Commitment } from "../src/lib/types";

// Let's copy the exact multiplier logic from our modified risk.ts
function getTestRemainingEffort(commitment: any, user: any): number {
  const domainMultipliers = user.learningCoefficients?.domainEffortMultipliers || {};
  const domainKey = commitment.domain;
  const rawMultiplier = domainMultipliers[domainKey] !== undefined 
    ? domainMultipliers[domainKey] 
    : (user.learningCoefficients?.underestimationFactor || 1.0);
  const multiplier = Math.max(0.5, Math.min(rawMultiplier, 2.0));
  
  const baseEffort = (commitment.adjustedEffortHours && commitment.adjustedEffortHours !== commitment.effortEstimateHours)
    ? commitment.adjustedEffortHours
    : (commitment.effortEstimateHours * multiplier);

  return (baseEffort || 0) * (1 - (commitment.completionPercentage || 0) / 100);
}

async function main() {
  console.log("=== Testing Domain Effort Multipliers ===");

  const mockUser: any = {
    uid: "test-user",
    learningCoefficients: {
      underestimationFactor: 1.2,
      domainEffortMultipliers: {
        academic: 1.8
      }
    }
  };

  const mockCommitment: any = {
    domain: "academic",
    effortEstimateHours: 10,
    completionPercentage: 0,
  };

  // Test case 1: academic multiplier set to 1.8 -> remaining effort should be 18
  let remainingEffort = getTestRemainingEffort(mockCommitment, mockUser);
  console.log(`Test 1: academic multiplier = 1.8. Remaining effort = ${remainingEffort} (Expected: 18)`);
  if (remainingEffort !== 18) {
    throw new Error(`Test 1 failed: expected 18, got ${remainingEffort}`);
  }

  // Test case 2: academic multiplier set to 3.0 -> remaining effort should be capped at 20 (cap of 2.0)
  mockUser.learningCoefficients.domainEffortMultipliers.academic = 3.0;
  remainingEffort = getTestRemainingEffort(mockCommitment, mockUser);
  console.log(`Test 2: academic multiplier = 3.0. Remaining effort = ${remainingEffort} (Expected: 20)`);
  if (remainingEffort !== 20) {
    throw new Error(`Test 2 failed: expected 20, got ${remainingEffort}`);
  }

  // Test case 3: academic multiplier set to 0.2 -> remaining effort should be capped at 5 (cap of 0.5)
  mockUser.learningCoefficients.domainEffortMultipliers.academic = 0.2;
  remainingEffort = getTestRemainingEffort(mockCommitment, mockUser);
  console.log(`Test 3: academic multiplier = 0.2. Remaining effort = ${remainingEffort} (Expected: 5)`);
  if (remainingEffort !== 5) {
    throw new Error(`Test 3 failed: expected 5, got ${remainingEffort}`);
  }

  // Test case 4: Fallback to underestimationFactor
  delete mockUser.learningCoefficients.domainEffortMultipliers.academic;
  remainingEffort = getTestRemainingEffort(mockCommitment, mockUser);
  console.log(`Test 4: Missing multiplier (fallback to underestimationFactor 1.2). Remaining effort = ${remainingEffort} (Expected: 12)`);
  if (remainingEffort !== 12) {
    throw new Error(`Test 4 failed: expected 12, got ${remainingEffort}`);
  }

  // Test case 5: Fallback to 1.0 if underestimationFactor also missing
  delete mockUser.learningCoefficients.underestimationFactor;
  remainingEffort = getTestRemainingEffort(mockCommitment, mockUser);
  console.log(`Test 5: Missing all factors (fallback to 1.0). Remaining effort = ${remainingEffort} (Expected: 10)`);
  if (remainingEffort !== 10) {
    throw new Error(`Test 5 failed: expected 10, got ${remainingEffort}`);
  }

  console.log("\nALL DOMAIN MULTIPLIER TESTS PASSED SUCCESSFULLY!");
}

main().catch(console.error);
