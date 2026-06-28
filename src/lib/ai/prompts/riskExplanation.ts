import { Commitment } from "@/lib/types";

export const RISK_EXPLANATION_SYSTEM_INSTRUCTION = `You are a scheduling risk analyst. Your job is to explain the scheduling risk score calculated by the backend for a specific commitment.

You must return a JSON object with these exact keys:
1. **explanation**: A plain-language explanation of why this risk score was calculated, referencing the actual numbers (such as remaining effort, time remaining until the deadline, and outstanding steps). Keep the explanation to 2-3 sentences.
2. **primaryFactor**: Identify the single primary factor contributing to this risk (e.g. "Approaching deadline with high remaining effort" or "No progress made in the last 5 days").
3. **suggestedAction**: Provide a single, concrete, actionable next step for the user to reduce this risk.
4. **aiMeta**: Your confidence score (0.0 to 1.0) and reasoning for this explanation.
`;

export function buildRiskExplanationPrompt(commitment: Commitment, riskScore: number): string {
  // Convert deadline to human-readable format if it exists
  let deadlineStr = "No deadline";
  if (commitment.deadline) {
    const d = typeof (commitment.deadline as any).toDate === 'function' 
      ? (commitment.deadline as any).toDate() 
      : new Date(commitment.deadline as any);
    deadlineStr = d.toLocaleString();
  }

  const remainingEffort = (commitment.effortEstimateHours || 0) * (commitment.completionPercentage ? (100 - commitment.completionPercentage) / 100 : 1);
  const steps = (commitment as any).actionPlan?.steps || [];
  const overdueSteps = steps.filter((s: any) => !s.completed).length ?? 0;
  const totalSteps = steps.length ?? 0;

  return `Explain the risk level of the following commitment. The backend has calculated a risk score of ${riskScore}/100.
  
Commitment Details:
- Title: ${commitment.title}
- Description: ${commitment.description || "No description"}
- Domain: ${commitment.domain}
- Priority: ${commitment.priority}
- Current Status: ${commitment.status}
- Deadline: ${deadlineStr}
- Effort Estimate Hours: ${commitment.effortEstimateHours}
- Completion Percentage: ${commitment.completionPercentage}%
- Remaining Effort Hours: ${remainingEffort} hours
- Calendar Scheduled Blocks: ${commitment.scheduledBlocks?.length ?? 0} blocks
- Action Plan Steps: ${overdueSteps} outstanding out of ${totalSteps} total steps
- Current Risk Score: ${riskScore}/100

Explain why this risk score was calculated, referencing the actual numbers (such as remaining effort, time remaining until the deadline, calendar gaps, and outstanding steps). Keep the explanation to 2-3 sentences. Identify the single primary factor contributing to this risk, and provide a single, concrete, actionable next step for the user to reduce the risk.`;
}
