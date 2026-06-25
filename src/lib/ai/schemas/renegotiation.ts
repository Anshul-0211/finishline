import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const proposedScheduleStepResponseSchema = z.object({
  date: z.string(), // ISO 8601
  duration: z.number().nonnegative(), // in minutes
  description: z.string(),
});

export const renegotiationResponseSchema = z.object({
  message: z.string(),
  hasProposedSchedule: z.boolean(),
  proposedSchedule: z.object({
    steps: z.array(proposedScheduleStepResponseSchema),
    generatedAt: z.string(), // ISO 8601
  }).nullable(),
  newDeadline: z.string().nullable(), // ISO 8601
  conflictsAvoided: z.array(z.string()),
  aiMeta: aiMetaSchema,
});
