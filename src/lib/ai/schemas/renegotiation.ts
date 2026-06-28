import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const proposedScheduleBlockSchema = z.object({
  start: z.string(), // ISO 8601
  end: z.string(),   // ISO 8601
});

export const renegotiationResponseSchema = z.object({
  message: z.string(),
  hasProposedSchedule: z.boolean(),
  proposedSchedule: z.object({
    summary: z.string(),
    blocks: z.array(proposedScheduleBlockSchema),
  }).nullable(),
  newDeadline: z.string().nullable(), // ISO 8601
  conflictsAvoided: z.array(z.string()),
  aiMeta: aiMetaSchema,
});

export const RenegotiationSchema = renegotiationResponseSchema;
