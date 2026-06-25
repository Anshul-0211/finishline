import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const weeklyReflectionResponseSchema = z.object({
  completionRate: z.number().min(0).max(100),
  narrative: z.string(),
  patternsObserved: z.array(z.string()),
  topInsight: z.string(),
  nextWeekRecommendation: z.string(),
  motivationalMessage: z.string(),
  aiMeta: aiMetaSchema,
});
