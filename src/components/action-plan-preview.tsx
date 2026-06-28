"use client";

import React from "react";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PillButton } from "@/components/ui/pill-button";

export interface ActionPlanPreviewProps {
  steps: Array<{
    id: string;
    title: string;
    estimatedMinutes: number;
    suggestedTimeSlot: "morning" | "afternoon" | "evening" | "any";
    cognitiveIntensity: "high" | "medium" | "low";
    notes?: string | null;
  }>;
  totalMinutes: number;
  requiresUserReview?: boolean;
  reviewReason?: string | null;
  aiMeta?: {
    confidence: number;
    confidenceLabel: "low" | "medium" | "high" | "very_high";
    reasoning: string;
  };
  loading?: boolean;
  onAccept: () => void;
  onRegenerate: () => void;
}

const COGNITIVE_COLORS: Record<"high" | "medium" | "low", string> = {
  high: "bg-error",
  medium: "bg-secondary",
  low: "bg-tertiary",
};

export const ActionPlanPreview: React.FC<ActionPlanPreviewProps> = ({
  steps,
  totalMinutes,
  requiresUserReview = false,
  reviewReason,
  aiMeta,
  loading = false,
  onAccept,
  onRegenerate,
}) => {
  if (loading) {
    return (
      <div className="space-y-4 font-sans">
        <div className="h-8 w-48 bg-surface-container animate-pulse rounded-md" />
        <SkeletonRow height={80} />
        <SkeletonRow height={80} />
        <SkeletonRow height={80} />
        <SkeletonRow height={80} />
      </div>
    );
  }

  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const timeString = hours > 0 ? `~${hours}h ${mins}m` : `~${mins}m`;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-[24px] shadow-card p-6 flex flex-col gap-5 font-sans transition-colors duration-200">
      {/* Header section */}
      <header className="flex justify-between items-center w-full pb-2 border-b border-outline-variant/30">
        <h2 className="text-[24px] font-bold text-on-surface font-sans tracking-tight">
          Your Action Plan
        </h2>
        {aiMeta?.confidenceLabel && (
          <ConfidenceBadge label={aiMeta.confidenceLabel} />
        )}
      </header>

      {/* Review Banner Alert */}
      {requiresUserReview && (
        <AmberReviewBanner message={reviewReason || "AI confidence factor requires manual verification."} />
      )}

      {/* Steps List */}
      <div className="divide-y divide-outline-variant/20">
        {steps.map((step, idx) => {
          const cogColorClass = COGNITIVE_COLORS[step.cognitiveIntensity] || "bg-outline";
          return (
            <div key={step.id || idx} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
              {/* Number Badge */}
              <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-sans font-bold flex items-center justify-center text-[14px] flex-shrink-0 mt-0.5 shadow-sm">
                {idx + 1}
              </div>

              {/* Step info block */}
              <div className="flex-1 min-w-0 space-y-2">
                <h4 className="text-[16px] font-semibold text-on-surface leading-snug">
                  {step.title}
                </h4>

                {/* Sub details row */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Duration */}
                  <span className="px-2.5 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-[11px] font-bold font-label tracking-wide">
                    {step.estimatedMinutes} mins
                  </span>

                  {/* Time slot suggest */}
                  <span className="px-2.5 py-0.5 border border-outline-variant text-on-surface-variant rounded-full text-[11px] font-semibold font-label capitalize">
                    {step.suggestedTimeSlot}
                  </span>

                  {/* Intensity */}
                  <div className="flex items-center gap-1.5 ml-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cogColorClass}`} />
                    <span className="text-[11px] font-semibold font-label text-on-surface-variant capitalize">
                      {step.cognitiveIntensity} effort
                    </span>
                  </div>
                </div>

                {step.notes && (
                  <p className="text-[12px] text-on-surface-variant font-sans leading-relaxed">
                    {step.notes}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary and Buttons footer */}
      <div className="pt-4 border-t border-outline-variant/40 flex flex-col gap-4">
        <div className="flex items-center justify-between text-on-surface-variant font-label text-[12px] font-semibold tracking-wide uppercase">
          <span>Estimated Total effort</span>
          <span className="text-[14px] text-on-surface font-bold normal-case">
            {timeString}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <PillButton variant="primary" onClick={onAccept} className="flex-1 text-sm whitespace-nowrap">
            Accept Plan
          </PillButton>
          <PillButton variant="outline" onClick={onRegenerate} className="text-sm whitespace-nowrap">
            Regenerate
          </PillButton>
        </div>
      </div>
    </div>
  );
};

export default ActionPlanPreview;
