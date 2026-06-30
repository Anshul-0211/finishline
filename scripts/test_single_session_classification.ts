import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { buildActionPlanPrompt, ACTION_PLAN_SYSTEM_INSTRUCTION } from "../src/lib/ai/prompts/actionPlan";
import { callGateway } from "../src/lib/ai/gateway";
import { ActionPlanSchema } from "../src/lib/ai/schemas/actionPlan";

async function main() {
  console.log("=== Testing Single-Session vs. Complex Task Classification ===");

  const mockContext = {
    currentDateTime: "2026-06-30T10:00:00.000Z",
    timezone: "UTC",
    underestimationFactor: 1.0,
    domainEffortMultipliers: {
      personal: 1.0,
      academic: 1.0
    },
    averageAttentionSpanMinutes: 45,
    preferredWorkHours: [9, 10, 11, 12, 13, 14, 15, 16],
    availableSlotsThisWeek: [
      { start: "2026-06-30T09:00:00.000Z", end: "2026-06-30T17:00:00.000Z" },
      { start: "2026-07-01T09:00:00.000Z", end: "2026-07-01T17:00:00.000Z" }
    ],
    stressScore: 5,
    activeCommitments: []
  };

  // Test Case 1: Single-Session Event (Dance Practice)
  const singleSessionCommitment = {
    title: "Dance Practice Session",
    description: "Scheduled practice at the studio on Wednesday evening.",
    domain: "personal",
    effortEstimateHours: 1.5, // 90 minutes
    difficulty: "medium",
    estimatedCognitiveLoad: "medium",
    deadline: "2026-07-01T15:00:00.000Z" // Exact scheduled event time
  };

  console.log("\n--- TEST CASE 1: Single-Session Event (Dance Practice) ---");
  const prompt1 = buildActionPlanPrompt(singleSessionCommitment, mockContext);
  try {
    const res1 = await callGateway<any>({
      systemInstruction: ACTION_PLAN_SYSTEM_INSTRUCTION,
      prompt: prompt1,
      schema: ActionPlanSchema as any,
      endpointType: "action-plan",
    });

    console.log("AI Gateway Result for Single-Session Event:");
    console.log(JSON.stringify(res1, null, 2));

    console.log("\nValidation Checks:");
    const stepsCount = res1.steps.length;
    console.log(`- Steps generated: ${stepsCount} (Expected: 1)`);
    if (stepsCount === 1) {
      console.log("✅ PASS: Correctly classified as single-session event (exactly 1 step generated).");
    } else {
      console.log("❌ FAIL: Generated multiple steps for a single-session event.");
    }

    const step = res1.steps[0];
    const suggestedTimeSlot = step?.suggestedTimeSlot;
    console.log(`- Suggested time slot: ${suggestedTimeSlot} (Expected: 2026-07-01T15:00:00.000Z)`);
    if (suggestedTimeSlot && suggestedTimeSlot.includes("2026-07-01T15:00:00.000Z")) {
      console.log("✅ PASS: Suggested time slot matches the event time exactly.");
    } else {
      console.log("❌ FAIL: Time slot did not match event time.");
    }
  } catch (err: any) {
    console.error("Test Case 1 Failed:", err.message);
  }

  // Test Case 2: Multi-Step Complex Task (Write OS Shell Assignment)
  const complexCommitment = {
    title: "Write OS Shell Assignment",
    description: "Implement simple shell in C supporting pipes, redirections, and background processes.",
    domain: "academic",
    effortEstimateHours: 4, // 240 minutes
    difficulty: "hard",
    estimatedCognitiveLoad: "high",
    deadline: "2026-07-02T17:00:00.000Z"
  };

  console.log("\n--- TEST CASE 2: Multi-Step Complex Task (OS Shell) ---");
  const prompt2 = buildActionPlanPrompt(complexCommitment, mockContext);
  try {
    const res2 = await callGateway<any>({
      systemInstruction: ACTION_PLAN_SYSTEM_INSTRUCTION,
      prompt: prompt2,
      schema: ActionPlanSchema as any,
      endpointType: "action-plan",
    });

    console.log("AI Gateway Result for Complex Task:");
    console.log(JSON.stringify(res2, null, 2));

    console.log("\nValidation Checks:");
    const stepsCount = res2.steps.length;
    console.log(`- Steps generated: ${stepsCount} (Expected: > 1)`);
    if (stepsCount > 1) {
      console.log("✅ PASS: Correctly classified as complex task (multiple steps generated).");
    } else {
      console.log("❌ FAIL: Generated only a single step for a complex task.");
    }
  } catch (err: any) {
    console.error("Test Case 2 Failed:", err.message);
  }
}

main().catch(console.error);
