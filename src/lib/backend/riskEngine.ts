import { Commitment, User } from "../types";

// Helper to convert date inputs (Timestamp, Date, string, number) to millisecond epoch
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
  if (typeof val._seconds === "number") {
    return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1000000);
  }
  if (typeof val.seconds === "number") {
    return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1000000);
  }
  return Date.now();
}

/**
 * Calculates the deterministic risk score (0-100) for a given commitment.
 */
export function calculateRiskScore(commitment: Commitment, user: User): number {
  const now = Date.now();
  const deadline = getMillis(commitment.deadline);
  const createdAt = getMillis(commitment.createdAt);
  const totalTime = deadline - createdAt;
  const remainingTime = Math.max(deadline - now, 0);

  // If no time left: maximum risk
  const remainingTimeHours = remainingTime / 3_600_000;
  if (remainingTimeHours <= 0) return 100;

  // Base: work rate vs required rate
  const remainingEffort = commitment.adjustedEffortHours * (1 - commitment.completionPercentage / 100);

  // Base risk = effort required per hour of remaining time
  const workloadRatio = remainingEffort / remainingTimeHours;

  // Calendar availability penalty (0 to 1)
  const availableHours = (commitment.scheduledBlocks || [])
    .filter(b => getMillis(b.start) > now)
    .reduce((acc, b) => acc + (getMillis(b.end) - getMillis(b.start)) / 3_600_000, 0);

  const calendarGap = Math.max(0, remainingEffort - availableHours);
  const calendarPenalty = remainingEffort > 0 ? Math.min(calendarGap / remainingEffort, 1) : 0;

  // Overdue subtask penalty
  const overdueSteps = commitment.actionPlan?.steps.filter(s => !s.completed).length ?? 0;
  const totalSteps = commitment.actionPlan?.steps.length ?? 1;
  const subtaskPenalty = overdueSteps / totalSteps * 0.2;

  // Days-since-progress penalty
  const daysSinceProgress = commitment.lastCheckInAt
    ? (now - getMillis(commitment.lastCheckInAt)) / 86_400_000
    : 999;
  const stalePenalty = Math.min(daysSinceProgress / 3, 1) * 0.15;

  // Combine
  const rawScore = (
    Math.min(workloadRatio * 40, 60) +      // max 60 from workload
    calendarPenalty * 20 +                  // max 20 from calendar gap
    subtaskPenalty * 100 +                  // max 20 from overdue steps (since subtaskPenalty is max 0.2)
    stalePenalty * 100                      // max 15 from staleness (since stalePenalty is max 0.15)
  );

  return Math.min(Math.round(rawScore), 100);
}

/**
 * Simulates probabilities of completion on the current vs recommended path.
 */
export function calculateProbability(
  commitment: Commitment,
  user: User,
  availableSlots: number
): {
  currentPath: number;
  recommendedPath: number;
} {
  const factor = user.learningCoefficients?.underestimationFactor || 1.0;
  const remaining = commitment.effortEstimateHours * factor * (1 - commitment.completionPercentage / 100);
  const deadline = getMillis(commitment.deadline);
  const hoursLeft = (deadline - Date.now()) / 3_600_000;

  // Current path: can you finish at your current rate?
  const createdAt = getMillis(commitment.createdAt);
  const elapsed = (Date.now() - createdAt) / 3_600_000;
  const currentRate = commitment.completedEffortHours / Math.max(elapsed, 1);
  const projectedCompletion = currentRate > 0 ? remaining / currentRate : Infinity;

  let currentProb = 0;
  if (hoursLeft <= 0) {
    currentProb = 0;
  } else if (projectedCompletion === Infinity || isNaN(projectedCompletion)) {
    currentProb = 0;
  } else {
    currentProb = Math.max(0, Math.min(
      100 - ((projectedCompletion - hoursLeft) / hoursLeft) * 100,
      100
    ));
  }

  // Recommended path: if you use all available slots productively
  const productiveSlotHours = availableSlots * 0.75; // 75% productivity assumption
  let recommendedProb = 0;
  if (remaining <= 0) {
    recommendedProb = 99;
  } else {
    recommendedProb = Math.min(
      productiveSlotHours >= remaining ? 95 : (productiveSlotHours / remaining) * 95,
      99
    );
  }

  const currentPathRound = Math.round(Math.max(5, currentProb));
  const recommendedPathRound = Math.round(Math.max(currentPathRound + 10, recommendedProb));

  return {
    currentPath: currentPathRound,
    recommendedPath: Math.min(recommendedPathRound, 99),
  };
}
