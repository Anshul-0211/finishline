import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { buildActionPlanPrompt, ACTION_PLAN_SYSTEM_INSTRUCTION } from "../src/lib/ai/prompts/actionPlan";
import { callGateway } from "../src/lib/ai/gateway";
import { ActionPlanSchema } from "../src/lib/ai/schemas/actionPlan";

async function main() {
  console.log("=== Testing Action Plan Prompts with Domain Multipliers & Attention Span ===");

  const mockContext = {
    currentDateTime: new Date().toISOString(),
    timezone: "UTC",
    underestimationFactor: 1.2,
    domainEffortMultipliers: {
      academic: 1.5,
      work: 1.0
    },
    averageAttentionSpanMinutes: 40,
    preferredWorkHours: [9, 10, 11, 12, 13, 14, 15, 16],
    availableSlotsThisWeek: [
      { start: "2026-06-30T09:00:00.000Z", end: "2026-06-30T17:00:00.000Z" },
      { start: "2026-07-01T09:00:00.000Z", end: "2026-07-01T17:00:00.000Z" }
    ],
    stressScore: 10,
    activeCommitments: []
  };

  const mockCommitment = {
    title: "Write Academic Research Paper",
    description: "Write and format the initial draft of the CS paper.",
    domain: "academic",
    effortEstimateHours: 2, // 120 minutes raw. Scaled by 1.5 = 180 minutes.
    difficulty: "hard",
    estimatedCognitiveLoad: "high",
    deadline: "2026-07-02T17:00:00.000Z"
  };

  console.log("1. Building Action Plan Prompt...");
  const prompt = buildActionPlanPrompt(mockCommitment, mockContext);
  console.log("Generated Prompt:\n", prompt);

  console.log("\n2. Calling AI Gateway...");
  try {
    const rawResult = await callGateway<any>({
      systemInstruction: ACTION_PLAN_SYSTEM_INSTRUCTION,
      prompt,
      schema: ActionPlanSchema as any,
      endpointType: "action-plan",
    });

    console.log("\n=== AI Gateway Response ===");
    console.log(JSON.stringify(rawResult, null, 2));

    console.log("\n3. Validating Scaling and Chunking constraints...");
    const steps = rawResult.steps;
    console.log(`- Total estimated minutes returned: ${rawResult.totalMinutes} (Expected around 180 mins due to 1.5x scaling)`);
    console.log(`- Suggested session length: ${rawResult.suggestedSessionLength} mins (Expected <= 40 mins)`);
    
    let allStepsValid = true;
    for (const step of steps) {
      console.log(`  * Step: "${step.title}" - Duration: ${step.estimatedMinutes} mins`);
      if (step.estimatedMinutes > 40) {
        console.warn(`    WARNING: Step duration exceeds averageAttentionSpanMinutes (40 mins)!`);
        allStepsValid = false;
      }
    }
    
    if (allStepsValid && rawResult.suggestedSessionLength <= 40) {
      console.log("\nSUCCESS: All steps are bounded by the 40-minute attention span!");
    } else {
      console.log("\nPARTIAL SUCCESS: Steps or session length generated. Note whether LLM adhered to limits.");
    }
  } catch (err: any) {
    console.error("Gateway call failed:", err);
  }
}

main().catch(console.error);
