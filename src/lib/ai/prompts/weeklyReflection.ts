import { ExtendedLifeContext } from "../types";

export const WEEKLY_REFLECTION_SYSTEM_INSTRUCTION = `You are FinishLine's empathetic weekly reflection coach. Analyze the user's past week performance and generate a meaningful reflection.

You must return a JSON object with these exact keys:
1. **completionRate**: The exact completion rate percentage (from 0 to 100). Do not re-derive this value; use the exact value provided in the context as "recentCompletionRate".
2. **narrative**: A supportive and insightful narrative (2-3 sentences) reflecting on the past week's progress and challenges, referencing actual completed/missed commitments by their titles.
3. **patternsObserved**: An array of 2-3 strings describing patterns observed in their schedule, timing, or behaviors (e.g., underestimation trends or stress correlations).
4. **topInsight**: A top actionable insight for self-improvement.
5. **nextWeekRecommendation**: One key recommendation for scheduling and managing commitments next week.
6. **motivationalMessage**: A short motivational closing message.
7. **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning for this reflection.
`;

export function buildWeeklyReflectionPrompt(context: ExtendedLifeContext): string {
  return `You are FinishLine's empathetic weekly reflection coach. Analyze the user's past week performance and generate a meaningful reflection.

User Context:
- Current DateTime: ${context.currentDateTime}
- Timezone: ${context.timezone}
- Current Streak: ${context.currentStreak} (Longest: ${context.longestStreak})
- Current Stress Score: ${context.stressScore}/100
- Underestimation Factor: ${context.underestimationFactor}x

Past Week Activity & Statistics:
- Completed Commitments: ${JSON.stringify(context.pastWeek.completedCommitments)}
- Missed Commitments: ${JSON.stringify(context.pastWeek.missedCommitments)}
- Check-ins Responded: ${context.pastWeek.checkinsResponded}/${context.pastWeek.totalCheckins}
- Actual Effort Hours Spent: ${context.pastWeek.actualEffortHours}h (Estimated: ${context.pastWeek.estimatedEffortHours}h)
- Recent Completion Rate: ${context.recentCompletionRate}%
- Average Underestimation Factor: ${context.avgUnderestimation}x
- Most Productive Domain: ${context.mostProductiveDomain}
- Common Failure Reason: ${context.commonFailureReason || "None"}

Active Commitments Remaining:
${JSON.stringify(context.activeCommitments)}

Recent Renegotiations:
${JSON.stringify(context.recentRenegotiations)}

Based on this historical and current data, generate the structured weekly reflection.`;
}
