import React from "react";

export type SideAccentStatus = "in-progress" | "done" | "overdue";

export interface SideAccentProps {
  status: SideAccentStatus;
}

const ACCENT_STYLES: Record<SideAccentStatus, string> = {
  "in-progress": "bg-secondary-container", // Mapped to #FEA049
  done: "bg-tertiary-container",         // Mapped to #00837B
  overdue: "bg-error",                   // Mapped to #BA1A1A
};

export const SideAccent: React.FC<SideAccentProps> = ({ status }) => {
  const colorClass = ACCENT_STYLES[status] || "";

  return <div className={`w-1 h-full rounded-full flex-shrink-0 ${colorClass}`} />;
};

export default SideAccent;
