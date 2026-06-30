import React, { useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Check, X, Loader2 } from "lucide-react";
import { PillButton } from "@/components/ui/pill-button";

export interface Suggestion {
  id: string;
  type: 'domain_multiplier' | 'attention_span';
  description: string;
  proposedValue: any;
  confidence: number; // 0.0 to 1.0
  status: 'pending' | 'accepted' | 'dismissed';
  createdAt: string;
}

interface PersonalizationSuggestionCardProps {
  suggestion: Suggestion;
  onAccept: (id: string) => Promise<void>;
  onDismiss: (id: string) => Promise<void>;
}

export const PersonalizationSuggestionCard: React.FC<PersonalizationSuggestionCardProps> = ({
  suggestion,
  onAccept,
  onDismiss,
}) => {
  const [loadingAction, setLoadingAction] = useState<"accept" | "dismiss" | null>(null);

  const handleAcceptClick = async () => {
    setLoadingAction("accept");
    try {
      await onAccept(suggestion.id);
    } catch (err) {
      console.error("Failed to accept suggestion:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDismissClick = async () => {
    setLoadingAction("dismiss");
    try {
      await onDismiss(suggestion.id);
    } catch (err) {
      console.error("Failed to dismiss suggestion:", err);
    } finally {
      setLoadingAction(null);
    }
  };

  const confidencePercentage = Math.round(suggestion.confidence * 100);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ type: "spring", stiffness: 450, damping: 30 }}
      className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] shadow-card p-5 max-w-[480px] w-full flex flex-col gap-4 relative overflow-hidden"
    >
      {/* Top Badge & Confidence */}
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold font-label tracking-wide uppercase bg-primary/10 text-primary">
          <Sparkles className="w-3 h-3" />
          <span>
            {suggestion.type === "attention_span" ? "Attention Span" : "Domain Multiplier"}
          </span>
        </span>

        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-bold text-on-surface-variant font-label">
            {confidencePercentage}% confidence
          </span>
          <div className="w-16 h-1.5 bg-outline-variant/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${confidencePercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Description text */}
      <p className="text-[14px] font-medium text-on-surface leading-relaxed pr-2">
        {suggestion.description}
      </p>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1 border-t border-outline-variant/20">
        <PillButton
          variant="primary"
          onClick={handleAcceptClick}
          loading={loadingAction === "accept"}
          disabled={loadingAction !== null}
          className="flex-1 h-10 text-xs font-semibold"
        >
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            <span>Accept Suggestion</span>
          </span>
        </PillButton>

        <PillButton
          variant="outline"
          onClick={handleDismissClick}
          loading={loadingAction === "dismiss"}
          disabled={loadingAction !== null}
          className="flex-shrink-0 h-10 text-xs font-semibold px-4"
        >
          <span className="flex items-center justify-center">
            {loadingAction === "dismiss" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <X className="w-3.5 h-3.5" />
            )}
          </span>
        </PillButton>
      </div>
    </motion.div>
  );
};

export default PersonalizationSuggestionCard;
