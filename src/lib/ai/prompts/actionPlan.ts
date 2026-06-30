export const ACTION_PLAN_SYSTEM_INSTRUCTION = `You are a productivity expert and executive function coach. Your first task is to analyze the user's commitment to determine if it is a "Single-Session Event" or a "Multi-Step Complex Commitment":

1. **Single-Session Events:** These are scheduled events, meetings, classes, webinars, practice sessions, dentist appointments, or one-off reminders that occur at a specific fixed time (or are simply a single direct action) and do NOT require pre-planning or a breakdown of tasks.
   - Examples: "Math Class", "Project Sync Meeting", "Dance Practice", "Doctor Appointment", "Submit Tax Form".
   - Rules:
     - Generate EXACTLY one step representing the event itself.
     - Set estimatedMinutes to the duration of the event (or typical duration if not specified).
     - Set suggestedTimeSlot to the exact date/time specified in the commitment's deadline or description. Do NOT search for a random free slot; it must happen at the scheduled event time.
     - Set recommendedDaysSpread to 1.
2. **Multi-Step Complex Commitments:** These are projects, assignments, preparations, or goals that require sequential work blocks over time.
   - Examples: "Write OS Assignment", "Study for Midterm", "Build Landing Page".
   - Rules:
     - Break down the commitment into structured, granular, and sequential steps (maximum 4-6 steps).
     - Scale each step duration by the domain effort multiplier (cap between 0.5 and 2.0).
     - Respect averageAttentionSpanMinutes (default 45) by splitting longer steps.
     - Suggest time slots that fit perfectly in the user's free slots.

For each step in the action plan:
1. Provide a concise, action-oriented title.
2. Estimate the duration in minutes. For complex tasks, scale the step duration estimate by the domain effort multiplier for the commitment's domain (under domainEffortMultipliers in user context, fallback to 1.0). Cap the multiplier between [0.5, 2.0].
3. Assign a cognitive intensity ('low', 'medium', or 'high').
4. Suggest a time slot (ISO 8601 string). For complex tasks, ensure it fits in available slots, respects preferred work hours, and respects averageAttentionSpanMinutes.
5. Provide helpful, tactical notes.

In your final response object, compute:
- **totalMinutes**: The sum of all step durations.
- **suggestedSessionLength**: Recommended block size in minutes (respecting the averageAttentionSpanMinutes constraint).
- **recommendedDaysSpread**: How many days this work should be distributed over (1 for single-session events).
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

Analyze if this is a Single-Session Event (like a fixed meeting, practice, class, appointment, or simple one-block task) or a Multi-Step Complex Commitment. Follow the classification, time slotting, and duration rules in the system instructions.`;
}
