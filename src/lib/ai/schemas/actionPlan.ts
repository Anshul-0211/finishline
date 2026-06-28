import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const actionPlanStepResponseSchema = z.object({
  id: z.string(),
  title: z.string(),
  estimatedMinutes: z.number().nonnegative(),
  suggestedTimeSlot: z.string().nullable(), // ISO 8601
  cognitiveIntensity: z.enum(['low', 'medium', 'high']).nullable(),
  notes: z.string().nullable(),
});

export const actionPlanResponseSchema = z.object({
  steps: z.array(actionPlanStepResponseSchema),
  totalMinutes: z.number().nonnegative(),
  suggestedSessionLength: z.number().nonnegative(),
  recommendedDaysSpread: z.number().nonnegative(),
  aiMeta: aiMetaSchema,
});

export const ActionPlanSchema = actionPlanResponseSchema;
