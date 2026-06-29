import { AIResponseMeta } from "./types";

export function deriveConfidenceLabel(confidence: number): AIResponseMeta['confidenceLabel'] {
  if (confidence >= 0.90) return 'very_high';
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.50) return 'medium';
  return 'low';
}

export function applyConfidenceAwareness<T extends { aiMeta: { confidence: number; reasoning: string } }>(result: T): T & {
  requiresUserReview: boolean;
  reviewReason: string | null;
} {
  const { confidence, reasoning } = result.aiMeta;
  const label = deriveConfidenceLabel(confidence);

  const requiresUserReview = confidence < 0.5;
  const reviewReason = requiresUserReview
    ? `AI confidence is ${label} (${Math.round(confidence * 100)}%): ${reasoning}`
    : null;

  return {
    ...result,
    requiresUserReview,
    reviewReason,
  };
}
