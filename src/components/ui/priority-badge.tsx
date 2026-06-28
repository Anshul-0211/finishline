import React from "react";

export type PriorityType = "critical" | "high" | "medium" | "low";

export interface PriorityBadgeProps {
  priority: PriorityType;
}

const PRIORITY_STYLES: Record<PriorityType, string> = {
  critical: "text-error bg-error/10",
  high: "text-secondary bg-secondary/10",
  medium: "text-secondary-container bg-secondary-container/10",
  low: "text-outline bg-outline/10",
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const displayLabel = priority.charAt(0).toUpperCase() + priority.slice(1);
  const colorClass = PRIORITY_STYLES[priority] || "";

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full tracking-wide ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
};

export default PriorityBadge;
