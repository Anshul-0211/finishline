import { z } from "zod";

export const gmailSuggestionResponseSchema = z.object({
  gmailMessageId: z.string(),
  subject: z.string(),
  from: z.string(),
  extractedTitle: z.string(),
  extractedDeadline: z.string().nullable(), // ISO 8601
  extractedEffort: z.number().nullable(),
  extractedDomain: z.enum(['academic', 'work', 'personal', 'health', 'social', 'family']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
});
