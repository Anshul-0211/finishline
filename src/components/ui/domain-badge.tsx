import React from "react";

export type DomainType = "academic" | "work" | "personal" | "health" | "social" | "family";

export interface DomainBadgeProps {
  domain: DomainType;
}

const DOMAIN_STYLES: Record<DomainType, string> = {
  academic: "text-primary bg-primary/10",
  work: "text-primary-container bg-primary-container/10",
  personal: "text-secondary bg-secondary/10",
  health: "text-tertiary bg-tertiary/10",
  social: "text-on-surface-variant bg-on-surface-variant/10",
  family: "text-error bg-error/10",
};

export const DomainBadge: React.FC<DomainBadgeProps> = ({ domain }) => {
  const displayLabel = domain.charAt(0).toUpperCase() + domain.slice(1);
  const colorClass = DOMAIN_STYLES[domain] || "";

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 text-xs font-semibold rounded-full tracking-wide ${colorClass}`}
    >
      {displayLabel}
    </span>
  );
};

export default DomainBadge;
