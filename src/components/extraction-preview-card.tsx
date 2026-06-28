"use client";

import React, { useState } from "react";
import { Calendar, Clock, X } from "lucide-react";
import { motion } from "framer-motion";
import { SPRING_SMOOTH } from "@/lib/motion";
import { DomainBadge, DomainType } from "@/components/ui/domain-badge";
import { PriorityBadge, PriorityType } from "@/components/ui/priority-badge";
import { SideAccent } from "@/components/ui/side-accent";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { PillButton } from "@/components/ui/pill-button";

export interface ExtractionPreviewCardProps {
  title: string;
  domain: DomainType;
  priority: PriorityType;
  deadline: string | null; // ISO 8601 or formatted date string
  effortEstimateHours: number;
  confidence: number; // 0–1
  requiresUserReview?: boolean;
  onConfirm: () => void;
  onEdit: () => void;
  onClose: () => void;
}

export const ExtractionPreviewCard: React.FC<ExtractionPreviewCardProps> = ({
  title,
  domain,
  priority,
  deadline,
  effortEstimateHours,
  confidence,
  requiresUserReview = false,
  onConfirm,
  onEdit,
  onClose,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState(title);

  // Confidence calculations
  const confidencePercent = Math.round(confidence * 100);
  
  let confidenceColorClass = "bg-error text-error";
  if (confidence > 0.7) {
    confidenceColorClass = "bg-tertiary text-tertiary";
  } else if (confidence >= 0.5) {
    confidenceColorClass = "bg-secondary text-secondary";
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setIsEditing(false);
    }
  };

  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
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
    <motion.div
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={SPRING_SMOOTH}
      className="bg-surface-container-lowest rounded-[24px] p-5 pl-7 shadow-card relative border border-white/20 dark:border-white/8 flex flex-col gap-4 overflow-hidden outline-none"
    >
      {/* Side Accent Line - Always Orange/in-progress for extractions */}
      <div className="absolute left-0 top-0 bottom-0 w-1">
        <SideAccent status="in-progress" />
      </div>

      {/* Header Row */}
      <div className="flex justify-between items-center w-full">
        <span className="inline-flex items-center justify-center px-2.5 py-0.5 text-[12px] font-semibold font-label text-primary bg-primary/10 rounded-full tracking-wide">
          AI Extracted
        </span>
        <button
          onClick={onClose}
          className="text-outline hover:text-on-surface transition-colors p-1 rounded-full hover:bg-surface-container-high outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close extraction preview"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editable Title Section */}
      <div className="w-full">
        {isEditing ? (
          <input
            type="text"
            value={currentTitle}
            onChange={(e) => setCurrentTitle(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={handleKeyDown}
            className="border-b border-primary bg-transparent text-[18px] font-semibold text-on-surface font-sans w-full outline-none py-1 focus:border-primary-container"
            autoFocus
          />
        ) : (
          <h3
            onClick={() => setIsEditing(true)}
            className="text-[18px] font-semibold text-on-surface font-sans cursor-pointer hover:border-b hover:border-dashed hover:border-primary border-b border-transparent py-1 w-full line-clamp-2 leading-snug"
            title="Click to edit title"
          >
            {currentTitle}
          </h3>
        )}
      </div>

      {/* Metadata Badges (Domain & Priority) */}
      <div className="flex items-center gap-2">
        <DomainBadge domain={domain} />
        <PriorityBadge priority={priority} />
      </div>

      {/* Deadline and Effort info */}
      <div className="flex flex-wrap items-center gap-4 text-on-surface-variant font-label text-[12px] font-semibold tracking-wide">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{formattedDeadline}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{effortEstimateHours}h effort</span>
        </div>
      </div>

      {/* Confidence gauge bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center text-[12px] font-semibold font-label">
          <span className="text-on-surface-variant">Extraction Confidence</span>
          <span className={confidenceColorClass.split(" ")[1]}>
            {confidencePercent}% confident
          </span>
        </div>
        <div className="w-full h-1.5 bg-surface-container rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${
              confidenceColorClass.split(" ")[0]
            }`}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Warnings & User Review Flag Banner */}
      {requiresUserReview && (
        <div className="mt-1">
          <AmberReviewBanner message="Low extraction confidence. Please review the details manually before generating your accountability plan." />
        </div>
      )}

      {/* Control Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 mt-2 w-full">
        <PillButton
          variant="primary"
          onClick={onConfirm}
          className="flex-1 text-sm whitespace-nowrap"
        >
          Confirm and Generate Plan
        </PillButton>
        <PillButton
          variant="outline"
          onClick={onEdit}
          className="text-sm whitespace-nowrap"
        >
          Edit manually
        </PillButton>
      </div>
    </motion.div>
  );
};

export default ExtractionPreviewCard;
