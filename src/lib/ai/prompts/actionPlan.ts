import { CommitmentDraft, CoreLifeContext } from "../types";

export function buildActionPlanPrompt(commitment: CommitmentDraft, context: CoreLifeContext): string {
  return `Create a customized, step-by-step action plan to complete the following commitment:
  
Commitment Details:
- Title: ${commitment.title}
- Description: ${commitment.description}
- Domain: ${commitment.domain}
- Estimated Effort: ${commitment.effortEstimateHours} hours
- Deadline: ${commitment.deadline || "None"}
- Difficulty: ${commitment.difficulty}
- Cognitive Load: ${commitment.estimatedCognitiveLoad}

User Context:
- Current DateTime: ${context.currentDateTime}
- Timezone: ${context.timezone}
- Underestimation Factor: ${context.underestimationFactor}x
- Preferred Work Hours: ${context.preferredWorkHours.join(", ")}
- Available Calendar Slots: ${JSON.stringify(context.availableSlotsThisWeek)}
- Current Stress Score: ${context.stressScore}/100

Break this commitment down into granular, sequential steps. For each step, provide a clear title, estimated duration in minutes, cognitive intensity (low, medium, high), and notes. Ensure the suggestedTimeSlot for each step fits within the provided available calendar slots and respects the user's preferred work hours.`;
}
