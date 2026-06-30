import { z } from "zod";

export const ReplanCascadeSchema = z.object({
  summary: z.string().describe("Concise, friendly narrative of the overall calendar optimization strategy."),
  conflictsDetected: z.array(z.string()).describe("A list of conflicts identified in the pre-existing schedule."),
  adjustments: z.array(
    z.object({
      commitmentId: z.string(),
      commitmentTitle: z.string(),
      originalBlock: z.object({
        start: z.string().describe("ISO 8601 string"),
        end: z.string().describe("ISO 8601 string"),
      }),
      proposedBlock: z.object({
        start: z.string().describe("ISO 8601 string"),
        end: z.string().describe("ISO 8601 string"),
      }),
    })
  ).describe("Full sequence of calendar block re-allocations required to balance the week."),
  aiMeta: z.object({
    confidence: z.number().min(0.0).max(1.0),
    confidenceLabel: z.enum(["low", "medium", "high", "very_high"]),
    reasoning: z.string().describe("Explanation for why these specific schedule adjustments were chosen."),
  }),
});
