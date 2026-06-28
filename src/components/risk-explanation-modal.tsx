"use client";

import React, { useEffect, useRef } from "react";
import { X, Zap, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PillButton } from "@/components/ui/pill-button";

export interface RiskExplanationModalProps {
  open: boolean;
  onClose: () => void;
  commitmentTitle: string;
  loading?: boolean;
  explanation?: string;
  primaryFactor?: string;
  suggestedAction?: string;
  requiresUserReview?: boolean;
  reviewReason?: string | null;
  aiMeta?: {
    confidence: number;
    confidenceLabel: "low" | "medium" | "high" | "very_high";
    reasoning: string;
  };
}

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  initial: { y: 10, opacity: 0 },
  animate: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 300, damping: 25 } },
  exit: { y: 10, opacity: 0 },
};

export const RiskExplanationModal: React.FC<RiskExplanationModalProps> = ({
  open,
  onClose,
  commitmentTitle,
  loading = false,
  explanation,
  primaryFactor,
  suggestedAction,
  requiresUserReview = false,
  reviewReason,
  aiMeta,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Esc key and Focus Trap hook
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    const focusableElementsString =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const modal = modalRef.current;
    
    if (modal) {
      const focusableElements = modal.querySelectorAll<HTMLElement>(focusableElementsString);
      const firstFocusableElement = focusableElements[0];
      const lastFocusableElement = focusableElements[focusableElements.length - 1];

      if (firstFocusableElement) {
        firstFocusableElement.focus();
      }

      const trapFocus = (e: KeyboardEvent) => {
        if (e.key !== "Tab") return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusableElement) {
            lastFocusableElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusableElement) {
            firstFocusableElement.focus();
            e.preventDefault();
          }
        }
      };

      modal.addEventListener("keydown", trapFocus);

      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        modal.removeEventListener("keydown", trapFocus);
      };
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  const reasoningText = explanation || aiMeta?.reasoning || "No detailed risk analysis is available.";

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Dark Backdrop (always dark regardless of theme) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 dark:bg-black/72 backdrop-blur-[12px] dark:backdrop-blur-[16px]"
          />

          {/* Modal Panel Container */}
          <motion.div
            ref={modalRef}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", duration: 0.2 }}
            className="relative w-full max-w-[360px] bg-surface-container-lowest rounded-[24px] border border-white/20 dark:border-white/8 shadow-modal p-6 flex flex-col gap-4 overflow-hidden z-10 font-sans outline-none"
            role="dialog"
            aria-modal="true"
          >
            {/* X Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-outline hover:text-on-surface transition-colors p-1.5 rounded-full hover:bg-surface-container-high outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Close explanation modal"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header section */}
            <header className="pr-6 space-y-2 mt-1">
              <div className="flex flex-col gap-2">
                {aiMeta?.confidenceLabel && (
                  <div className="self-start">
                    <ConfidenceBadge label={aiMeta.confidenceLabel} />
                  </div>
                )}
                <h2 className="text-[18px] font-bold text-on-surface font-sans leading-snug">
                  Why is "{commitmentTitle}" at risk?
                </h2>
              </div>
            </header>

            {/* Requires manual review alert banner */}
            {requiresUserReview && (
              <AmberReviewBanner message={reviewReason || "Low AI confidence factor. Requires manual verification."} />
            )}

            {/* Content area / loading state */}
            {loading ? (
              <div className="space-y-4 my-2">
                <SkeletonRow height={60} />
                <SkeletonRow height={40} />
                <SkeletonRow height={40} />
              </div>
            ) : (
              <motion.div
                variants={containerVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="space-y-4"
              >
                {/* Explanation text */}
                <motion.div variants={itemVariants} className="space-y-1">
                  <span className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase">
                    Explanation
                  </span>
                  <p className="text-[16px] text-on-surface leading-relaxed">
                    {reasoningText}
                  </p>
                </motion.div>

                {/* Primary Factor Badge strip */}
                {primaryFactor && (
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <span className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase">
                      Primary Factor
                    </span>
                    <div className="flex items-center gap-2 p-3 bg-secondary-container/15 rounded-md">
                      <Zap className="w-4 h-4 text-secondary flex-shrink-0" />
                      <span className="text-[14px] font-semibold text-secondary font-sans">
                        {primaryFactor}
                      </span>
                    </div>
                  </motion.div>
                )}

                {/* Suggested Action section */}
                {suggestedAction && (
                  <motion.div variants={itemVariants} className="space-y-1.5">
                    <span className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase">
                      Suggested Action
                    </span>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <p className="text-[16px] text-on-surface leading-normal">
                        {suggestedAction}
                      </p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Bottom confirm footer */}
            <div className="mt-2">
              <PillButton variant="primary" onClick={onClose} className="w-full">
                Got it
              </PillButton>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default RiskExplanationModal;
