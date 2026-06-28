import { z } from "zod";

export const gmailSuggestionSchema = z.object({
  gmailMessageId: z.string(),
  subject: z.string(),
  from: z.string(),
  hasCommitment: z.boolean(),
  extractedTitle: z.string(),
  extractedDeadline: z.string().nullable(), // ISO 8601
  extractedEffort: z.number().nullable(),
  extractedDomain: z.enum(['academic', 'work', 'personal', 'health', 'social', 'family']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  urgencyLevel: z.enum(['low', 'medium', 'high', 'critical']),
  senderImportance: z.enum(['low', 'medium', 'high', 'recruiter', 'vip']),
  requiresResponse: z.boolean(),
  responseDeadline: z.string().nullable(), // ISO 8601
});

export type GmailSuggestion = z.infer<typeof gmailSuggestionSchema>;

// Backward compatibility wrapper
export const gmailSuggestionResponseSchema = gmailSuggestionSchema;
