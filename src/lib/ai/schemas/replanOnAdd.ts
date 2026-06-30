import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const replanOnAddResponseSchema = z.object({
  summary: z.string(),
  conflictsDetected: z.array(z.string()),
  conflictsAvoided: z.array(z.string()),
  adjustments: z.array(z.object({
    commitmentId: z.string(),
    commitmentTitle: z.string(),
    originalBlock: z.object({ start: z.string(), end: z.string() }),
    proposedBlock: z.object({ start: z.string(), end: z.string() })
  })),
  requiresUserReview: z.boolean(),
  reviewReason: z.string().nullable(),
  aiMeta: aiMetaSchema
});

export const ReplanOnAddSchema = replanOnAddResponseSchema;
