import React from "react";

export interface RiskBadgeProps {
  score: number;
}

const getRiskZoneStyles = (score: number): string => {
  if (score >= 0 && score <= 29) {
    return "text-tertiary bg-tertiary/10 border-tertiary";
  }
  if (score >= 30 && score <= 59) {
    return "text-secondary bg-secondary/10 border-secondary";
  }
  if (score >= 60 && score <= 79) {
    return "text-secondary-container bg-secondary-container/10 border-secondary-container";
  }
  return "text-error bg-error/10 border-error";
};

export const RiskBadge: React.FC<RiskBadgeProps> = ({ score }) => {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  const themeClasses = getRiskZoneStyles(normalizedScore);

  return (
    <div
      className={`flex items-center justify-center w-6 h-6 rounded-full border text-[16px] font-sans font-extrabold ${themeClasses}`}
    >
      {normalizedScore}
    </div>
  );
};

export default RiskBadge;
