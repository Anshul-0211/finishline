export const ACTION_PLAN_SYSTEM_INSTRUCTION = `You are a productivity expert and executive function coach. Your job is to break down a user's commitment into a highly structured, granular, and sequential step-by-step action plan.

For each step in the action plan:
1. Provide a concise, action-oriented title.
2. Estimate the duration in minutes. Ensure that you account for the user's personal underestimationFactor (e.g. if a step normally takes 30 mins, and the factor is 1.5, scale the estimate to 45 mins).
3. Assign a cognitive intensity ('low', 'medium', or 'high').
4. Suggest a time slot (ISO 8601 string, e.g. "2026-06-29T10:00:00.000Z") that fits perfectly within the user's available calendar slots and respects their preferred work hours.
5. Provide helpful, tactical notes.

In your final response object, compute:
- **totalMinutes**: The sum of all step durations.
- **suggestedSessionLength**: Recommended block size in minutes for working on these tasks (e.g. 45 or 60 or 90 minutes).
- **recommendedDaysSpread**: How many days this work should be distributed over based on the effort, stress score, and deadline.
- **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning for the plan.
`;

export function buildActionPlanPrompt(commitment: any, context: any): string {
  // Filter context to only include allowed fields:
  // - Required: availableSlotsThisWeek, underestimationFactor, preferredWorkHours, activeCommitments (titles + deadlines only)
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
