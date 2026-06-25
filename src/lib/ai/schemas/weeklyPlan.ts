import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const weeklyPlanCommitmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  reasoning: z.string(),
});

export const weeklyPlanDailyFocusSchema = z.object({
  day: z.string(),
  focus: z.string(),
  commitments: z.array(z.string()),
});

export const weeklyPlanResponseSchema = z.object({
  weekSummary: z.string(),
  prioritizedCommitments: z.array(weeklyPlanCommitmentSchema),
  recommendedDailyFocus: z.array(weeklyPlanDailyFocusSchema),
  warningFlags: z.array(z.string()),
  lifeDomainAdvice: z.string(),
  resurfacedGoals: z.array(z.string()),
  weeklyIntention: z.string(),
  aiMeta: aiMetaSchema,
});
