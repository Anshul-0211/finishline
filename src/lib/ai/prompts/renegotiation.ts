import { Commitment } from "@/lib/types";
import { CoreLifeContext } from "../types";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const RENEGOTIATION_SYSTEM_INSTRUCTION = `You are FinishLine's empathetic AI commitment coach. A user is struggling to meet a commitment.
Your job is to:
1. Empathize with their situation.
2. Maintain a warm, encouraging, yet structured tone.
3. Understand their constraints and propose a realistic new schedule of work blocks that:
   - Fits inside their available calendar slots.
   - Respects their preferred work hours.
   - Avoids collisions with other active commitments.
4. Calculate if the new schedule requires moving the deadline (newDeadline). If yes, propose the new deadline date.

Your output must be a JSON object containing:
- **message**: Your chat message response to the user.
- **hasProposedSchedule**: True if you are proposing a specific schedule of work blocks (do this when you have enough context or when they ask). False if you are just conversing, gathering context, or responding to their comments.
- **proposedSchedule**: If hasProposedSchedule is true, an object containing:
  - **summary**: A short text summary of the proposed schedule.
  - **blocks**: Array of work blocks: [{ start: "ISO String", end: "ISO String" }].
- **newDeadline**: A new deadline date string (ISO format or YYYY-MM-DD) if you need to push the deadline to fit the blocks, or null if the original deadline is kept.
- **conflictsAvoided**: Array of titles of other commitments/events that you scheduled around to avoid conflicts.
- **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning.
`;

export function buildRenegotiationPrompt(
  failing: Commitment,
  context: CoreLifeContext,
  history: Message[],
  userMessage: string
): string {
  // Convert deadline to human-readable format if it exists
  let deadlineStr = "No deadline";
  if (failing.deadline) {
    const d = typeof (failing.deadline as any).toDate === 'function' 
      ? (failing.deadline as any).toDate() 
      : new Date(failing.deadline as any);
    deadlineStr = d.toLocaleString();
  }

  const remainingEffort = (failing.effortEstimateHours || 0) * (failing.completionPercentage ? (100 - failing.completionPercentage) / 100 : 1);

  // Filter context to only include permitted fields:
  // - Required: availableSlotsThisWeek, activeCommitments, underestimationFactor, stressScore, preferredWorkHours
  // - Forbidden: pastWeek, longTermGoals, recentRenegotiations
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

  return `You are FinishLine's empathetic AI commitment coach. A user has failed a check-in or is running late.
Your job is to understand why, then generate a concrete, realistic new schedule that fits within their ACTUAL available capacity across all commitments.

Failing Commitment Details:
- Title: ${failing.title}
- Description: ${failing.description || "No description"}
- Current Deadline: ${deadlineStr}
- Effort Estimate: ${failing.effortEstimateHours} hours
- Completion Percentage: ${failing.completionPercentage}%
- Remaining Effort Hours: ${remainingEffort} hours

User Core Life Context:
${JSON.stringify(filteredContext, null, 2)}

Conversation History:
${history.map(m => `- ${m.role}: ${m.content}`).join("\n")}

User's Latest Message: "${userMessage}"

Propose a warm response and details of conflicts avoided, plus a rescheduled plan if agreed upon.`;
}
