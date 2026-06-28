"use client";

import React, { useState, useEffect } from "react";
import { Mail, Calendar } from "lucide-react";
import { SideAccent } from "@/components/ui/side-accent";
import { PillButton } from "@/components/ui/pill-button";

export interface GmailSuggestionCardProps {
  sender: string;
  subject: string;
  commitmentTitle: string;
  deadline: string | null;
  urgencyLevel: "immediate" | "this_week" | "this_month" | "no_deadline";
  senderImportance: "professor" | "recruiter" | "manager" | "peer" | "system" | "unknown";
  requiresResponse: boolean;
  onAdd: () => void;
  onDismiss: () => void;
}

const URGENCY_MAP: Record<GmailSuggestionCardProps["urgencyLevel"], { classes: string; label: string }> = {
  immediate: { classes: "text-error bg-error/10", label: "Immediate" },
  this_week: { classes: "text-secondary bg-secondary/10", label: "This Week" },
  this_month: { classes: "text-secondary-container bg-secondary-container/10", label: "This Month" },
  no_deadline: { classes: "text-outline bg-outline/10", label: "No Deadline" },
};

const IMPORTANCE_MAP: Record<GmailSuggestionCardProps["senderImportance"], { classes: string; label: string }> = {
  recruiter: { classes: "text-tertiary bg-tertiary/10", label: "Recruiter" },
  professor: { classes: "text-primary bg-primary/10", label: "Professor" },
  manager: { classes: "text-primary-container bg-primary-container/10", label: "Manager" },
  peer: { classes: "text-outline bg-outline/10", label: "Peer" },
  system: { classes: "text-outline bg-outline/10", label: "System" },
  unknown: { classes: "text-outline bg-outline/10", label: "External" },
};

export const GmailSuggestionCard: React.FC<GmailSuggestionCardProps> = ({
  sender,
  subject,
  commitmentTitle,
  deadline,
  urgencyLevel,
  senderImportance,
  requiresResponse,
  onAdd,
  onDismiss,
}) => {
  const urgency = URGENCY_MAP[urgencyLevel] || URGENCY_MAP.no_deadline;
  const importance = IMPORTANCE_MAP[senderImportance] || IMPORTANCE_MAP.unknown;

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formattedDeadline = deadline
    ? (mounted ? formatDate(deadline) : "Loading deadline...")
    : "No deadline detected";

  return (
    <div className="bg-surface-container-lowest rounded-[24px] shadow-card p-4 pl-6 relative overflow-hidden flex flex-col gap-3.5 border border-outline-variant font-sans transition-all duration-200">
      {/* Orange Side Accent (Always Orange/in-progress for active AI suggestions) */}
      <div className="absolute left-0 top-0 bottom-0 w-1">
        <SideAccent status="in-progress" />
      </div>

      {/* Top sender line */}
      <div className="flex items-center gap-2 text-on-surface-variant font-label text-[12px] font-semibold tracking-wide w-full">
        <Mail className="w-3.5 h-3.5 text-outline flex-shrink-0" />
        <span className="truncate flex-1 max-w-[280px]" title={sender}>
          {sender}
        </span>
      </div>

      {/* Subject Line */}
      <h3 className="text-[16px] font-semibold text-on-surface leading-snug line-clamp-2" title={subject}>
        {subject}
      </h3>

      {/* Extracted Commitment Callout */}
      <div className="p-3 bg-surface-container rounded-xl space-y-1">
        <span className="block text-[10px] font-extrabold font-label text-primary uppercase tracking-widest">
          Detected commitment:
        </span>
        <p className="text-[14px] font-semibold text-on-surface leading-relaxed">
          {commitmentTitle}
        </p>
      </div>

      {/* Deadline Info */}
      <div className="flex items-center gap-1.5 text-on-surface-variant font-label text-[12px] font-semibold tracking-wide">
        <Calendar className="w-3.5 h-3.5 text-outline" />
        <span>{formattedDeadline}</span>
      </div>

      {/* Badges Row */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-label uppercase tracking-wider ${urgency.classes}`}>
          {urgency.label}
        </span>
        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-label uppercase tracking-wider ${importance.classes}`}>
          {importance.label}
        </span>
        {requiresResponse && (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold font-label uppercase tracking-wider text-error bg-error/10">
            Reply Required
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-between mt-1 pt-2 border-t border-outline-variant/30">
        <PillButton variant="primary" onClick={onAdd} className="text-xs px-4 h-9">
          Add this commitment
        </PillButton>
        <PillButton
          variant="ghost"
          onClick={onDismiss}
          className="text-outline hover:text-on-surface-variant text-xs px-3 h-9"
        >
          Dismiss
        </PillButton>
      </div>
    </div>
  );
};

export default GmailSuggestionCard;
