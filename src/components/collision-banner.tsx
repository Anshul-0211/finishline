"use client";

import React, { useState } from "react";
import { AlertTriangle, X, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export interface CollisionBannerProps {
  commitments: Array<{ id: string; title: string; collisionDetails: string | null }>;
  onRenegotiateClick: (commitmentId: string) => void;
  onDismiss: (commitmentId: string) => void;
}

export const CollisionBanner: React.FC<CollisionBannerProps> = ({
  commitments,
  onRenegotiateClick,
  onDismiss,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (commitments.length === 0) return null;

  const isMultiple = commitments.length > 1;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -64, opacity: 0 }}
        transition={{ type: "spring", stiffness: 380, damping: 28 }}
        className="w-full bg-error-container border-b-2 border-error font-sans select-none"
      >
        {isMultiple ? (
          /* Multiple conflicts view */
          <div className="flex flex-col w-full">
            <div
              onClick={() => setIsExpanded(!isExpanded)}
              className="px-4 py-[14px] flex items-center justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-200"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
                <span className="text-[16px] font-semibold text-on-surface leading-none">
                  {commitments.length} scheduling conflicts detected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold font-label text-on-surface-variant uppercase tracking-wider">
                  {isExpanded ? "Collapse" : "Expand to view"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-on-surface-variant transition-transform duration-300 ${
                    isExpanded ? "transform rotate-180" : ""
                  }`}
                />
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-error/20 divide-y divide-error/20 bg-black/[0.02] dark:bg-white/[0.02]">
                {commitments.map((c) => (
                  <div
                    key={c.id}
                    className="px-6 py-3 flex items-center justify-between gap-4 transition-colors duration-200 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                  >
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[14px] font-semibold text-on-surface truncate">
                        {c.title}
                      </h4>
                      {c.collisionDetails && (
                        <p className="text-[12px] font-semibold font-label text-on-surface-variant mt-0.5 line-clamp-2 leading-relaxed">
                          {c.collisionDetails}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <button
                        onClick={() => onRenegotiateClick(c.id)}
                        className="text-primary hover:text-primary-container text-[14px] font-semibold transition-colors duration-200 outline-none focus-visible:underline"
                      >
                        Renegotiate
                      </button>
                      <button
                        onClick={() => onDismiss(c.id)}
                        className="text-outline hover:text-on-surface transition-colors duration-200 p-1 outline-none"
                        aria-label={`Dismiss conflict for ${c.title}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Single conflict view */
          <div className="px-4 py-[14px] flex items-center justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertTriangle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[16px] font-semibold text-on-surface">
                    Scheduling conflict detected
                  </span>
                  <span className="text-[14px] text-on-error-container font-medium truncate">
                    — {commitments[0].title}
                  </span>
                </div>
                {commitments[0].collisionDetails && (
                  <p className="text-[12px] font-semibold font-label text-on-surface-variant mt-1 line-clamp-2 leading-relaxed">
                    {commitments[0].collisionDetails}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={() => onRenegotiateClick(commitments[0].id)}
                className="text-primary hover:text-primary-container text-[14px] font-semibold font-sans transition-colors duration-200 outline-none focus-visible:underline"
              >
                Renegotiate
              </button>
              <button
                onClick={() => onDismiss(commitments[0].id)}
                className="text-outline hover:text-on-surface transition-colors duration-200 p-1 outline-none"
                aria-label="Dismiss conflict notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default CollisionBanner;
