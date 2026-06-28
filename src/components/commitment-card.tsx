"use client";

import React from "react";
import { Calendar, TrendingUp, TrendingDown, Minus, Timer } from "lucide-react";
import { motion } from "framer-motion";
import { DomainBadge, DomainType } from "@/components/ui/domain-badge";
import { RiskBadge } from "@/components/ui/risk-badge";
import { SideAccent, SideAccentStatus } from "@/components/ui/side-accent";
import { ProgressBar } from "@/components/ui/progress-bar";
import { PriorityBadge, PriorityType } from "@/components/ui/priority-badge";
import { PillButton } from "@/components/ui/pill-button";

export interface CommitmentCardProps {
  id: string;
  title: string;
  domain: DomainType;
  deadline: string; // ISO 8601
  riskScore: number; // 0–100
  riskTrend: "improving" | "stable" | "worsening";
  completionPercentage: number;
  status: "active" | "completed" | "missed" | "deferred";
  priority: PriorityType;
  onWhyClick?: () => void;
  onFocusClick?: () => void;
}

const getDaysRemainingText = (deadlineStr: string): string => {
  const deadlineDate = new Date(deadlineStr);
  const today = new Date();
  
  // Normalize dates to remove time parts
  deadlineDate.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = deadlineDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    return `Overdue by ${absDays} day${absDays === 1 ? "" : "s"}`;
  }
  if (diffDays === 0) {
    return "Due today";
  }
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
};

const STATUS_TO_ACCENT: Record<CommitmentCardProps["status"], SideAccentStatus> = {
  active: "in-progress",
  completed: "done",
  missed: "overdue",
  deferred: "overdue",
};

export const CommitmentCard: React.FC<CommitmentCardProps> = ({
  id,
  title,
  domain,
  deadline,
  riskScore,
  riskTrend,
  completionPercentage,
  status,
  priority,
  onWhyClick,
  onFocusClick,
}) => {
  const accentStatus = STATUS_TO_ACCENT[status] || "in-progress";
  const daysText = getDaysRemainingText(deadline);

  // Determine trend icon
  let TrendIcon = Minus;
  let trendColorClass = "text-outline";
  
  if (riskTrend === "worsening") {
    TrendIcon = TrendingUp;
    trendColorClass = "text-error";
  } else if (riskTrend === "improving") {
    TrendIcon = TrendingDown;
    trendColorClass = "text-tertiary";
  }

  return (
    <motion.div
      layoutId={`commitment-${id}`}
      className="bg-surface-container-lowest rounded-[24px] p-4 pl-6 shadow-card relative overflow-hidden flex flex-col justify-between hover:bg-surface-container-low transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-offset-color)] outline-none group"
    >
      {/* Side Accent Line */}
      <div className="absolute left-0 top-0 bottom-0 w-1">
        <SideAccent status={accentStatus} />
      </div>

      <div className="space-y-4">
        {/* Top Badges and Risk info */}
        <div className="flex justify-between items-start w-full">
          <div className="flex items-center gap-2">
            <DomainBadge domain={domain} />
            <PriorityBadge priority={priority} />
          </div>
          <div className="flex items-center gap-1.5">
            <TrendIcon className={`w-4 h-4 flex-shrink-0 ${trendColorClass}`} />
            <RiskBadge score={riskScore} />
          </div>
        </div>

        {/* Card Title & Deadline */}
        <div className="space-y-2">
          <h3 className="text-[18px] font-semibold text-on-surface font-sans leading-snug line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {title}
          </h3>
          <div className="flex items-center gap-1.5 text-on-surface-variant font-label text-[12px] font-semibold tracking-wide">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{daysText}</span>
          </div>
        </div>
      </div>

      {/* Footer (Actions and Progress) */}
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {riskScore >= 30 && onWhyClick && (
              <PillButton
                variant="ghost"
                onClick={onWhyClick}
                className="text-xs px-2.5 h-8 text-primary hover:bg-primary/5"
              >
                Why?
              </PillButton>
            )}
            {onFocusClick && (
              <PillButton
                variant="ghost"
                onClick={onFocusClick}
                className="text-xs px-2.5 h-8 text-primary hover:bg-primary/5 gap-1"
              >
                <Timer className="w-3.5 h-3.5" />
                <span>Focus</span>
              </PillButton>
            )}
          </div>
          <span className="text-[12px] font-semibold font-label text-on-surface-variant">
            {completionPercentage}%
          </span>
        </div>
        
        <ProgressBar percentage={completionPercentage} />
      </div>
    </motion.div>
  );
};

export default CommitmentCard;
