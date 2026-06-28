import { ExtendedLifeContext } from "../types";

export const WEEKLY_PLANNING_SYSTEM_INSTRUCTION = `You are FinishLine's expert weekly planning coach. Analyze the user's Extended Life Context and design a structured, realistic plan for the upcoming week.

You must return a JSON object with these exact keys:
1. **weekSummary**: A concise overview summary (2-3 sentences) for the upcoming week, mentioning specific active commitment titles.
2. **prioritizedCommitments**: Array of objects: [{ "commitmentId": string, "priority": "critical"|"high"|"medium"|"low", "rationale": string }]. Covers all active commitments.
3. **recommendedDailyFocus**: Array of objects for each day of the upcoming week: [{ "day": string (e.g. "Monday"), "primaryCommitmentId": string|null, "suggestedHours": number, "note": string }].
4. **warningFlags**: Array of strings representing potential deadline collisions, overcommitments, or pitfalls.
5. **lifeDomainAdvice**: Encouraging advice to help balance academic, work, personal, and family responsibilities based on their stress level.
6. **resurfacedGoals**: Array of strings containing selected long-term goals that should be resurfaced or kept in mind this week.
7. **weeklyIntention**: A short, inspiring weekly intention or motto.
8. **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning for this weekly plan.
`;

export function buildWeeklyPlanningPrompt(context: ExtendedLifeContext): string {
  return `You are FinishLine's expert weekly planning coach. Analyze the user's Extended Life Context and design a structured, realistic plan for the upcoming week.

User Context:
- Current DateTime: ${context.currentDateTime}
- Timezone: ${context.timezone}
- Current Streak: ${context.currentStreak} (Longest: ${context.longestStreak})
- Current Stress Score: ${context.stressScore}/100
- Underestimation Factor: ${context.underestimationFactor}x
- Preferred Work Hours: ${context.preferredWorkHours.join(", ")}
- Available Slots This Week: ${JSON.stringify(context.availableSlotsThisWeek)}

Active Juggling Commitments:
${JSON.stringify(context.activeCommitments)}

Past Week Statistics:
- Completed Commitments: ${JSON.stringify(context.pastWeek.completedCommitments)}
- Missed Commitments: ${JSON.stringify(context.pastWeek.missedCommitments)}
- Check-ins Responded: ${context.pastWeek.checkinsResponded}/${context.pastWeek.totalCheckins}
- Actual Effort Spent: ${context.pastWeek.actualEffortHours}h (Estimated: ${context.pastWeek.estimatedEffortHours}h)
- Recent Completion Rate: ${context.recentCompletionRate}%
- Average Underestimation Factor: ${context.avgUnderestimation}x
- Most Productive Domain: ${context.mostProductiveDomain}
- Common Failure Reason: ${context.commonFailureReason || "None"}

Long-Term Goals:
${JSON.stringify(context.longTermGoals)}

Recent Renegotiations:
${JSON.stringify(context.recentRenegotiations)}

Based on the above context, generate the structured weekly plan.`;
}
