import { z } from "zod";
import { aiMetaSchema } from "./shared";

export const riskExplanationResponseSchema = z.object({
  explanation: z.string(),
  primaryFactor: z.string(),
  suggestedAction: z.string(),
  aiMeta: aiMetaSchema,
});

export const RiskExplanationSchema = riskExplanationResponseSchema;
