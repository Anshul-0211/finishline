import { z } from "zod";

export const commitmentDraftSchema = z.object({
  title: z.string(),
  description: z.string(),
  domain: z.enum(['academic', 'work', 'personal', 'health', 'social', 'family']),
  deadline: z.string().nullable(), // ISO 8601
  isLongTermGoal: z.boolean(),
  effortEstimateHours: z.number().nonnegative(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),

  difficulty: z.enum(['easy', 'medium', 'hard', 'expert']),
  estimatedCognitiveLoad: z.enum(['low', 'medium', 'high']),
  commitmentType: z.enum(['assignment', 'exam', 'project', 'meeting', 'event', 'interview', 'other']),
  practicalVsTheoretical: z.enum(['practical', 'theoretical', 'mixed']).nullable(),
  questionCount: z.number().nullable(),
  recommendedSessions: z.number().nonnegative(),
  prerequisiteKnowledge: z.array(z.string()),
  stakeholderImportance: z.enum(['low', 'medium', 'high', 'critical']),
  requiredResponse: z.boolean(),
  extractedEntities: z.object({
    people: z.array(z.string()),
    locations: z.array(z.string()),
    tools: z.array(z.string()),
  }),
});
