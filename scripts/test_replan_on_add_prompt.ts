import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { buildReplanOnAddPrompt, REPLAN_ON_ADD_SYSTEM_INSTRUCTION } from "../src/lib/ai/prompts/replanOnAdd";
import { callGateway } from "../src/lib/ai/gateway";
import { ReplanOnAddSchema } from "../src/lib/ai/schemas/replanOnAdd";

async function main() {
  console.log("=== Testing Dynamic Replanning Engine (replan-on-add) ===");

  const mockContext: any = {
    currentDateTime: "2026-06-30T08:00:00.000Z",
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
    activeCommitments: [
      {
        id: "commitment-existing-work",
        title: "Existing API Refactoring",
        domain: "work",
        deadline: "2026-07-02T17:00:00.000Z",
        remainingEffortHours: 2,
        scheduledBlocks: [
          { start: "2026-06-30T10:00:00.000Z", end: "2026-06-30T12:00:00.000Z" }
        ]
      }
    ]
  };

  const mockNewCommitment = {
    title: "New OS Exam Preparation",
    domain: "academic",
    effortEstimateHours: 2,
    deadline: "2026-07-03T17:00:00.000Z"
  };

  // Directly collides with the existing work task's block (10:00 - 12:00)
  const mockProposedBlocks = [
    { start: "2026-06-30T10:30:00.000Z", end: "2026-06-30T12:30:00.000Z" }
  ];

  console.log("1. Building Replan Prompt...");
  const prompt = buildReplanOnAddPrompt(mockNewCommitment, mockProposedBlocks, mockContext);
  console.log("\nGenerated Prompt:\n", prompt);

  console.log("\n2. Calling AI Gateway...");
  try {
    const rawResult = await callGateway<any>({
      systemInstruction: REPLAN_ON_ADD_SYSTEM_INSTRUCTION,
      prompt,
      schema: ReplanOnAddSchema as any,
      endpointType: "action-plan",
    });

    console.log("\n=== AI Gateway Response ===");
    console.log(JSON.stringify(rawResult, null, 2));

    console.log("\n3. Validating JSON outputs matches Zod expectations...");
    const parsed = ReplanOnAddSchema.parse(rawResult);
    console.log("- Zod parsing passed successfully!");
    console.log(`- Conflicts Detected: ${parsed.conflictsDetected.join(", ")}`);
    console.log(`- Adjustments Recommended: ${parsed.adjustments.length}`);
    parsed.adjustments.forEach((adj) => {
      console.log(`  * Shifted: ${adj.commitmentTitle} (${adj.commitmentId})`);
      console.log(`    Original: ${adj.originalBlock.start} -> ${adj.originalBlock.end}`);
      console.log(`    Proposed: ${adj.proposedBlock.start} -> ${adj.proposedBlock.end}`);
    });

  } catch (e: any) {
    console.error("Test failed during E2E Execution:", e);
    process.exit(1);
  }
}

main().catch(console.error);
