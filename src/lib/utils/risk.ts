import { Commitment, User } from "@/lib/types";

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
  if (!val) return Date.now();
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
  return Date.now();
}

/**
 * Calculates the deterministic risk score (0-100) for a given commitment.
 */
export function calculateRiskScore(commitment: Commitment, user: User): number {
  const now = Date.now();
  const deadline = getMillis(commitment.deadline);
  const remainingTime = Math.max(deadline - now, 0);
  const remainingTimeHours = remainingTime / 3_600_000;

  // If no time left: maximum risk
  if (remainingTimeHours <= 0) return 100;

  const domainMultipliers = user.learningCoefficients?.domainEffortMultipliers || {};
  const domainKey = commitment.domain;
  const rawMultiplier = domainMultipliers[domainKey] !== undefined 
    ? domainMultipliers[domainKey] 
    : (user.learningCoefficients?.underestimationFactor || 1.0);
  const multiplier = Math.max(0.5, Math.min(rawMultiplier, 2.0));
  
  const baseEffort = (commitment.adjustedEffortHours && commitment.adjustedEffortHours !== commitment.effortEstimateHours)
    ? commitment.adjustedEffortHours
    : (commitment.effortEstimateHours * multiplier);

  const remainingEffort = (baseEffort || 0) * (1 - (commitment.completionPercentage || 0) / 100);

  // Time pressure = effort required divided by remaining hours
  const workloadRatio = remainingEffort / remainingTimeHours;

  // Calendar availability gap penalty (0 to 1)
  const availableHours = (commitment.scheduledBlocks || [])
    .filter(b => getMillis(b.start) > now)
    .reduce((acc, b) => acc + (getMillis(b.end) - getMillis(b.start)) / 3_600_000, 0);

  const calendarGap = Math.max(0, remainingEffort - availableHours);
  const calendarGapRatio = remainingEffort > 0 ? Math.min(calendarGap / remainingEffort, 1) : 0;

  // Overdue steps penalty
  const overdueSteps = commitment.actionPlan?.steps.filter(s => !s.completed).length ?? 0;
  const totalSteps = commitment.actionPlan?.steps.length ?? 1;
  const overdueRatio = overdueSteps / Math.max(totalSteps, 1);

  // Staleness penalty
  const daysSinceProgress = commitment.lastCheckInAt
    ? (now - getMillis(commitment.lastCheckInAt)) / 86_400_000
    : 999;
  const staleness = Math.min(daysSinceProgress / 3, 1);

  // Combine using weights:
  // - Time pressure: max 75
  // - Calendar gap: max 25
  // - Overdue steps: max 15
  // - Staleness: max 15
  const rawScore = (
    Math.min(workloadRatio * 75, 75) +
    calendarGapRatio * 25 +
    overdueRatio * 15 +
    staleness * 15
  );

  return Math.min(Math.round(rawScore), 100);
}

/**
 * Calculates the deterministic completion probability (0.0 to 1.0).
 */
export function calculateProbability(commitment: Commitment, user: User): number {
  const now = Date.now();
  const deadline = getMillis(commitment.deadline);
  const remainingTimeHours = Math.max((deadline - now) / 3_600_000, 0);

  if (remainingTimeHours <= 0) return 0.0;

  const domainMultipliers = user.learningCoefficients?.domainEffortMultipliers || {};
  const domainKey = commitment.domain;
  const rawMultiplier = domainMultipliers[domainKey] !== undefined 
    ? domainMultipliers[domainKey] 
    : (user.learningCoefficients?.underestimationFactor || 1.0);
  const multiplier = Math.max(0.5, Math.min(rawMultiplier, 2.0));
  
  const baseEffort = (commitment.adjustedEffortHours && commitment.adjustedEffortHours !== commitment.effortEstimateHours)
    ? commitment.adjustedEffortHours
    : (commitment.effortEstimateHours * multiplier);

  const remainingEffort = (baseEffort || 0) * (1 - (commitment.completionPercentage || 0) / 100);

  if (remainingEffort <= 0) return 1.0;

  const availableHours = (commitment.scheduledBlocks || [])
    .filter(b => getMillis(b.start) > now)
    .reduce((acc, b) => acc + (getMillis(b.end) - getMillis(b.start)) / 3_600_000, 0);

  // Probability is calculated based on:
  // 1. Scheduled calendar hours ratio (60% weight)
  // 2. Remaining time left ratio (40% weight)
  const scheduledRatio = availableHours >= remainingEffort ? 1.0 : (availableHours / remainingEffort);
  const totalTimeRatio = remainingTimeHours >= remainingEffort ? 1.0 : (remainingTimeHours / remainingEffort);

  const prob = (scheduledRatio * 0.6) + (totalTimeRatio * 0.4);
  return Math.max(0.0, Math.min(Math.round(prob * 100) / 100, 1.0));
}

/**
 * Determines the risk trend category.
 */
export function computeRiskTrend(currentScore: number, previousScore: number): 'improving' | 'stable' | 'worsening' {
  const threshold = 5;
  if (currentScore > previousScore + threshold) {
    return 'worsening';
  } else if (currentScore < previousScore - threshold) {
    return 'improving';
  } else {
    return 'stable';
  }
}

/**
 * Computes the accumulated user stress score based on active commitments' risks and weights.
 */
export function computeStressScore(commitments: Commitment[]): number {
  const stress = commitments.reduce((acc, c) => {
    if (c.status === "active" || c.status === "renegotiating") {
      let weight = 1.0;
      switch (c.priority) {
        case "critical": weight = 1.5; break;
        case "high": weight = 1.2; break;
        case "medium": weight = 1.0; break;
        case "low": weight = 0.8; break;
      }
      return acc + (c.riskScore || 0) * weight;
    }
    return acc;
  }, 0);

  return Math.min(Math.round(stress), 100);
}
