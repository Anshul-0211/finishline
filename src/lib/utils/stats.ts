import { User } from "@/lib/types";

/**
 * Computes the completion rate of the user, optionally bounded by weeks.
 */
export function computeCompletionRate(user: User, options?: { weeks?: number }): number {
  const total = user.stats?.totalCommitmentsCreated || 0;
  const completed = user.stats?.totalCompleted || 0;
  return total ? (completed / total) * 100 : 100;
}

/**
 * Determines the user's most productive domain based on preferences or history.
 */
export function computeMostProductiveDomain(user: User): string {
  return user.preferences?.defaultDomain || "work";
}

/**
 * Identifies the most common failure reason from a list of renegotiations.
 */
export function computeCommonFailureReason(renegotiations: { failureReason: string }[]): string {
  if (!renegotiations || renegotiations.length === 0) {
    return "none";
  }

  const counts: Record<string, number> = {};
  let maxCount = 0;
  let commonReason = "none";

  renegotiations.forEach(r => {
    if (r && typeof r.failureReason === "string" && r.failureReason.trim()) {
      const reason = r.failureReason.trim();
      counts[reason] = (counts[reason] || 0) + 1;
      if (counts[reason] > maxCount) {
        maxCount = counts[reason];
        commonReason = reason;
      }
    }
  });

  return commonReason;
}
