import React from "react";

export type ConfidenceType = "very_high" | "high" | "medium" | "low";

export interface ConfidenceBadgeProps {
  label: ConfidenceType;
}

interface ConfidenceConfig {
  classes: string;
  text: string;
}

const CONFIDENCE_MAP: Record<ConfidenceType, ConfidenceConfig> = {
  very_high: {
    classes: "text-tertiary bg-tertiary/10",
    text: "Very High Confidence",
  },
  high: {
    classes: "text-primary bg-primary/10",
    text: "High Confidence",
  },
  medium: {
    classes: "text-secondary bg-secondary/10",
    text: "Medium Confidence",
  },
  low: {
    classes: "text-error bg-error/10",
    text: "Low Confidence",
  },
};

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({ label }) => {
  const config = CONFIDENCE_MAP[label] || CONFIDENCE_MAP.medium;

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-label text-[12px] font-semibold tracking-[0.05em] ${config.classes}`}
    >
      {config.text}
    </span>
  );
};

export default ConfidenceBadge;
