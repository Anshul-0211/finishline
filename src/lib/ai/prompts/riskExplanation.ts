import { Commitment } from "@/lib/types";

export function buildRiskExplanationPrompt(commitment: Commitment, riskScore: number): string {
  // Convert deadline to human-readable format if it exists
  let deadlineStr = "No deadline";
  if (commitment.deadline) {
    const d = typeof commitment.deadline.toDate === 'function' 
      ? commitment.deadline.toDate() 
      : new Date(commitment.deadline);
    deadlineStr = d.toLocaleString();
  }

  const remainingEffort = commitment.adjustedEffortHours - commitment.completedEffortHours;
  const overdueSteps = commitment.actionPlan?.steps.filter(s => !s.completed).length ?? 0;
  const totalSteps = commitment.actionPlan?.steps.length ?? 0;

  return `Explain the risk level of the following commitment. The backend has calculated a risk score of ${riskScore}/100.
  
Commitment Details:
- Title: ${commitment.title}
- Description: ${commitment.description}
- Domain: ${commitment.domain}
- Priority: ${commitment.priority}
- Current Status: ${commitment.status}
- Deadline: ${deadlineStr}
- Adjusted Effort Hours: ${commitment.adjustedEffortHours}
- Completed Effort Hours: ${commitment.completedEffortHours}
- Remaining Effort Hours: ${remainingEffort} hours
- Completion Percentage: ${commitment.completionPercentage}%
- Calendar Scheduled Blocks: ${commitment.scheduledBlocks?.length ?? 0} blocks
- Action Plan Steps: ${overdueSteps} outstanding out of ${totalSteps} total steps
- Current Risk Score: ${riskScore}/100

Explain why this risk score was calculated, referencing the actual numbers (such as remaining effort, time remaining until the deadline, calendar gaps, and outstanding steps). Keep the explanation to 2-3 sentences. Identify the single primary factor contributing to this risk, and provide a single, concrete, actionable next step for the user to reduce the risk.`;
}
