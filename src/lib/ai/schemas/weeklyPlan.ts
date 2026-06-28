import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const prioritizedCommitmentSchema = z.object({
  commitmentId: z.string(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  rationale: z.string(),
});

export const recommendedDailyFocusSchema = z.object({
  day: z.string(), // e.g., "Monday"
  primaryCommitmentId: z.string().nullable(),
  suggestedHours: z.number().nonnegative(),
  note: z.string(),
});

export const weeklyPlanResponseSchema = z.object({
  weekSummary: z.string(),
  prioritizedCommitments: z.array(prioritizedCommitmentSchema),
  recommendedDailyFocus: z.array(recommendedDailyFocusSchema),
  warningFlags: z.array(z.string()),
  lifeDomainAdvice: z.string(),
  resurfacedGoals: z.array(z.string()),
  weeklyIntention: z.string(),
  aiMeta: aiMetaSchema,
});

export const WeeklyPlanSchema = weeklyPlanResponseSchema;
