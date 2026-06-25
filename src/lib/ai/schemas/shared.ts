import { z } from "zod";

export const aiMetaSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
});
