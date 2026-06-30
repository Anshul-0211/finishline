export const ACTION_PLAN_SYSTEM_INSTRUCTION = `You are a productivity expert and executive function coach. Your job is to break down a user's commitment into a highly structured, granular, and sequential step-by-step action plan.

For each step in the action plan:
1. Provide a concise, action-oriented title.
2. Estimate the duration in minutes. Look up the domain effort multiplier for the commitment's domain (e.g., 'academic', 'work', etc.) in the user context (under domainEffortMultipliers). If absent, fall back to underestimationFactor or 1.0. Scale the step duration estimate by this multiplier, capped between [0.5, 2.0].
3. Assign a cognitive intensity ('low', 'medium', or 'high').
4. Suggest a time slot (ISO 8601 string, e.g. "2026-06-29T10:00:00.000Z") that fits perfectly within the user's available calendar slots and respects their preferred work hours. Ensure that the duration of each focus block does not exceed averageAttentionSpanMinutes (which defaults to 45). Break down longer steps or tasks into separate blocks bounded by this attention span.
5. Provide helpful, tactical notes.

In your final response object, compute:
- **totalMinutes**: The sum of all step durations.
- **suggestedSessionLength**: Recommended block size in minutes for working on these tasks (respecting the averageAttentionSpanMinutes constraint).
- **recommendedDaysSpread**: How many days this work should be distributed over based on the effort, stress score, and deadline.
- **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning for the plan.
`;

export function buildActionPlanPrompt(commitment: any, context: any): string {
  // Filter context to only include allowed fields:
  // - Required: availableSlotsThisWeek, underestimationFactor, preferredWorkHours, activeCommitments (titles + deadlines only), domainEffortMultipliers, averageAttentionSpanMinutes
  // - Optional: stressScore
  // - Forbidden: pastWeek, recentRenegotiations, longTermGoals, any Extended fields
  const filteredActiveCommitments = (context.activeCommitments || []).map((c: any) => ({
    title: c.title,
    deadline: c.deadline
  }));

  const filteredContext = {
    currentDateTime: context.currentDateTime,
    timezone: context.timezone,
    underestimationFactor: context.underestimationFactor,
    domainEffortMultipliers: context.domainEffortMultipliers,
    averageAttentionSpanMinutes: context.averageAttentionSpanMinutes,
    preferredWorkHours: context.preferredWorkHours,
    availableSlotsThisWeek: context.availableSlotsThisWeek,
    stressScore: context.stressScore,
    activeCommitments: filteredActiveCommitments
  };

  return `Create a customized, step-by-step action plan to complete the following commitment:
  
Commitment Details:
- Title: ${commitment.title}
- Description: ${commitment.description || "No description"}
- Domain: ${commitment.domain}
- Estimated Effort: ${commitment.effortEstimateHours} hours
- Deadline: ${commitment.deadline || "None"}
- Difficulty: ${commitment.difficulty}
- Cognitive Load: ${commitment.estimatedCognitiveLoad}

User Context:
${JSON.stringify(filteredContext, null, 2)}

Break this commitment down into granular, sequential steps. Ensure that steps are scheduled into the user's available calendar slots, respect preferred work hours, and don't collide with the user's active commitments.`;
}
