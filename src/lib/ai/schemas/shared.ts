import { z } from "zod";

export const aiMetaSchema = z.object({
  confidence: z.number().min(0).max(1),
  confidenceLabel: z.enum(["low", "medium", "high", "very_high"]),
  reasoning: z.string(),
});
