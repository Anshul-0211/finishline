"use client";

import React, { useState, useEffect } from "react";
import { CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { SPRING_SMOOTH } from "@/lib/motion";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { PillButton } from "@/components/ui/pill-button";

export interface ProposedScheduleCardProps {
  summary: string;
  blocks: Array<{ date: string; durationMinutes: number; goal: string }>;
  newDeadline?: string | null;
  conflictsAvoided?: string[];
  requiresUserReview?: boolean;
  reviewReason?: string | null;
  aiMeta?: {
    confidence: number;
    confidenceLabel: "low" | "medium" | "high" | "very_high";
    reasoning: string;
  };
  onConfirm: () => void;
  onSuggestAlternative: () => void;
}

export const ProposedScheduleCard: React.FC<ProposedScheduleCardProps> = ({
  summary,
  blocks,
  newDeadline,
  conflictsAvoided = [],
  requiresUserReview = false,
  reviewReason,
  aiMeta,
  onConfirm,
  onSuggestAlternative,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatBlockDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${weekdays[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "Invalid Date";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING_SMOOTH}
      className="bg-surface-container-low border border-outline-variant rounded-[24px] shadow-card p-5 pl-7 w-full relative overflow-hidden flex flex-col gap-4 font-sans transition-colors duration-200"
    >
      {/* Primary Color Side Accent Line (Uses Token) */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />

      {/* Header section */}
      <header className="flex justify-between items-center w-full pb-1">
        <h3 className="text-[18px] font-bold text-on-surface font-sans">
          Proposed Schedule
        </h3>
        {aiMeta?.confidenceLabel && (
          <ConfidenceBadge label={aiMeta.confidenceLabel} />
        )}
      </header>

      {/* Summary paragraph */}
      <p className="text-[14px] text-on-surface-variant font-sans leading-relaxed">
        {summary}
      </p>

      {/* Review Alert Banner */}
      {requiresUserReview && (
        <AmberReviewBanner message={reviewReason || "AI scheduling conflicts need verification."} />
      )}

      {/* Schedule blocks list */}
      <div className="space-y-1 bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/35 divide-y divide-outline-variant/20">
        {blocks.map((block, idx) => (
          <div key={idx} className="py-2.5 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
            <div className="space-y-0.5">
              <span className="block text-[14px] font-semibold text-on-surface font-sans leading-none">
                {mounted ? formatBlockDate(block.date) : "Loading date..."}
              </span>
              <span className="block text-[12px] text-on-surface-variant font-label font-medium leading-tight">
                Goal: {block.goal}
              </span>
            </div>
            <span className="text-[14px] font-semibold text-on-surface font-label flex-shrink-0">
              {block.durationMinutes} mins
            </span>
          </div>
        ))}
      </div>

      {/* New Deadline alert highlight row */}
      {newDeadline && (
        <div className="p-3 bg-primary/10 rounded-xl text-primary text-[14px] font-semibold font-sans flex items-center justify-between gap-2 border border-primary/20">
          <span>New deadline recommendation:</span>
          <span>
            {mounted ? formatDate(newDeadline) : "Loading deadline..."}
          </span>
        </div>
      )}

      {/* Conflicts Avoided list */}
      {conflictsAvoided.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="block text-[10px] font-extrabold font-label text-outline uppercase tracking-widest">
            Conflicts Avoided:
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {conflictsAvoided.map((c, idx) => (
              <div key={idx} className="flex items-center gap-1 text-[12px] font-semibold font-label text-tertiary">
                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 mt-2 w-full">
        <PillButton variant="primary" onClick={onConfirm} className="w-full text-sm">
          Confirm this schedule
        </PillButton>
        <PillButton variant="outline" onClick={onSuggestAlternative} className="w-full text-sm">
          Suggest something else
        </PillButton>
      </div>
    </motion.div>
  );
};

export default ProposedScheduleCard;
