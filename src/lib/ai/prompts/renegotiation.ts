import { Commitment } from "@/lib/types";
import { CoreLifeContext } from "../types";

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function buildRenegotiationPrompt(
  failing: Commitment,
  context: CoreLifeContext,
  history: Message[],
  userMessage: string
): string {
  let deadlineStr = "None";
  if (failing.deadline) {
    const d = typeof (failing.deadline as any).toDate === "function"
      ? (failing.deadline as any).toDate()
      : new Date(failing.deadline);
    deadlineStr = d.toLocaleString();
  }

  return `You are FinishLine's empathetic AI commitment coach. A user has failed a check-in or is running late.
Your job is to understand why, then generate a concrete, realistic new schedule that fits within their ACTUAL available capacity across all commitments.

Failing Commitment Details:
- Title: ${failing.title}
- Description: ${failing.description}
- Current Deadline: ${deadlineStr}
- Effort Estimate: ${failing.effortEstimateHours} hours
- Completion Percentage: ${failing.completionPercentage}%
- Remaining Effort Hours: ${failing.adjustedEffortHours - failing.completedEffortHours} hours

User Core Life Context:
- Current DateTime: ${context.currentDateTime}
- Preferred Work Hours: ${context.preferredWorkHours.join(", ")}
- Available Slots This Week: ${JSON.stringify(context.availableSlotsThisWeek)}
- Active Juggling Commitments: ${JSON.stringify(context.activeCommitments)}
- Current Stress Score: ${context.stressScore}/100

Conversation History:
${history.map(m => `- ${m.role}: ${m.content}`).join("\n")}

User's Latest Message: "${userMessage}"

Propose a warm response and details of conflicts avoided, plus a rescheduled plan if agreed upon.`;
}
