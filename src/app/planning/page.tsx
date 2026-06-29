"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, Scale, RefreshCw, Loader2, ArrowLeft } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PillButton } from "@/components/ui/pill-button";

interface PrioritizedCommitment {
  commitmentId: string;
  priority: number;
  rationale: string;
}

interface RecommendedDailyFocus {
  day: string;
  primaryCommitmentId: string;
  suggestedHours: number;
  note: string | null;
}

interface WeeklyPlanResponse {
  weekSummary: string;
  prioritizedCommitments: PrioritizedCommitment[];
  recommendedDailyFocus: RecommendedDailyFocus[];
  warningFlags: string[];
  lifeDomainAdvice: string;
  resurfacedGoals: string[];
  weeklyIntention: string;
  aiMeta: {
    confidence: number;
    confidenceLabel: string;
    reasoning: string;
  };
  requiresUserReview: boolean;
  reviewReason: string | null;
}

export default function WeeklyPlanningPage() {
  const router = useRouter();
  const { user, setUser, userProfile } = useUserStore();
  const { commitments, subscribeToCommitments } = useCommitmentsStore();

  const [generationState, setGenerationState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [planData, setPlanData] = useState<WeeklyPlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        router.push("/");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribeAuth();
  }, [router, setUser]);

  // Firestore Commitments Subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCommitments(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToCommitments]);

  // Generate Plan Handler
  const handleGenerate = async () => {
    if (!user) return;
    setGenerationState("loading");
    setError(null);
    try {
      console.log("[Frontend] Triggering /api/ai/weekly-planning for user:", user.uid);
      const res = await fetch("/api/ai/weekly-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });
      console.log("[Frontend] /api/ai/weekly-planning response status:", res.status);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] Plan generated successfully:", data);
      setPlanData(data);
      setGenerationState("ready");
    } catch (e: any) {
      console.error("[Frontend] handleGenerate failed:", e);
      setError(e.message ?? "Generation failed. Try again.");
      setGenerationState("error");
    }
  };

  const handleRegenerate = () => {
    setPlanData(null);
    setGenerationState("idle");
  };

  const getTitle = (id: string | null | undefined) => {
    if (!id) return "General Focus";
    return commitments.find((c) => c.id === id)?.title ?? `Commitment ${id.slice(0, 6)}`;
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-1/2 mx-auto px-6 py-8 flex flex-col gap-8 font-sans">
        
        {/* Back Link Header */}
        <header className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-primary hover:text-primary-container text-[14px] font-semibold outline-none w-fit focus-visible:underline"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <h1 className="text-[26px] font-bold text-on-surface tracking-[-0.01em] leading-none">
            Weekly Planning
          </h1>
        </header>
        <AnimatePresence mode="wait">
          {(generationState === "idle" || generationState === "error") && (
            /* PRE-GENERATION / ERROR HERO STATE */
            <motion.div
              key="idle"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -15, opacity: 0 }}
              className="flex flex-col items-center justify-center text-center py-16 gap-6"
            >
              <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl shadow-sm select-none">
                📅
              </div>

              <div className="space-y-2 max-w-[320px]">
                <h2 className="text-[24px] font-bold text-on-surface leading-tight tracking-tight">
                  Generate your AI weekly plan
                </h2>
                <p className="text-[16px] text-on-surface-variant leading-relaxed">
                  Gemini analyzes all your commitments and free time to build your optimal week.
                </p>
              </div>

              {generationState === "error" && error && (
                <div className="flex items-center gap-2.5 p-4 bg-error-container text-on-error-container rounded-xl text-[14px] font-semibold font-sans w-full max-w-[320px] mb-2 border border-error/20">
                  <AlertTriangle className="w-4.5 h-4.5 text-error flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <PillButton
                variant={generationState === "error" ? "outline" : "primary"}
                onClick={handleGenerate}
                className="w-full max-w-[280px] h-[56px] text-[16px] font-semibold flex items-center justify-center gap-2"
              >
                {generationState !== "error" && <Sparkles className="w-5 h-5 flex-shrink-0" />}
                <span>{generationState === "error" ? "Try Again" : "Generate My Week"}</span>
              </PillButton>
            </motion.div>
          )}

          {generationState === "loading" && (
            /* LOADING STATE */
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-6 py-6"
            >
              <div className="flex flex-col items-center justify-center text-center gap-2.5 pb-4">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <span className="text-[16px] font-bold text-on-surface leading-none">
                  Gemini is organizing your week...
                </span>
              </div>
              <SkeletonRow height={80} />
              <SkeletonRow height={80} />
              <SkeletonRow height={80} />
              <SkeletonRow height={80} />
              <SkeletonRow height={80} />
            </motion.div>
          )}

          {generationState === "ready" && planData && (
            /* POST-GENERATION STATE */
            <motion.div
              key="ready"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-8"
            >
              {/* Requires User Review / Low Confidence Banner */}
              {(planData.requiresUserReview || (planData.aiMeta?.confidence !== undefined && planData.aiMeta.confidence < 0.5)) && (
                <AmberReviewBanner message={planData.reviewReason ?? `Low AI Confidence (${Math.round((planData.aiMeta?.confidence ?? 0) * 100)}%): ${planData.aiMeta?.reasoning}`} />
              )}

              {/* WEEKLY INTENTION CARD */}
              <section className="bg-surface-container-lowest rounded-[24px] shadow-modal p-6 relative overflow-hidden pt-8 border border-outline-variant/30 flex flex-col gap-4">
                {/* Gradient header strip */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-container" />

                <header className="flex justify-between items-start w-full gap-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-[12px] font-semibold font-label text-primary tracking-wider uppercase">
                      This Week's Intention
                    </span>
                  </div>
                  {(() => {
                    const label = (planData.aiMeta.confidenceLabel === "very_high" ||
                      planData.aiMeta.confidenceLabel === "high" ||
                      planData.aiMeta.confidenceLabel === "medium" ||
                      planData.aiMeta.confidenceLabel === "low")
                      ? planData.aiMeta.confidenceLabel
                      : "medium";
                    return <ConfidenceBadge label={label} />;
                  })()}
                </header>

                <div className="space-y-2">
                  <h3 className="text-[24px] font-bold text-on-surface font-sans leading-tight">
                    {planData.weeklyIntention}
                  </h3>
                  <p className="text-[16px] text-on-surface-variant font-sans leading-relaxed">
                    {planData.weekSummary}
                  </p>
                </div>
              </section>

              {/* DAY ROWS (Mon-Sun) */}
              <section className="space-y-3">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Daily Allocation
                </h4>
                <div>
                  {planData.recommendedDailyFocus.map((day, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container-lowest rounded-md px-[14px] py-3 shadow-card mb-2 flex items-center justify-between gap-3 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors"
                    >
                      <span className="text-[14px] font-bold text-on-surface font-sans w-10">
                        {day.day}
                      </span>
                      <span className="text-[14px] text-on-surface-variant font-sans flex-1 truncate">
                        {getTitle(day.primaryCommitmentId)}
                      </span>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[12px] font-bold text-primary font-label">
                          {day.suggestedHours} hrs
                        </span>
                        {day.note && (
                          <span className="text-[11px] text-outline font-label mt-0.5">
                            {day.note}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* WARNING FLAGS (Watch Out) */}
              {planData.warningFlags.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-[14px] font-bold text-secondary font-sans pl-1">
                    Watch Out
                  </h4>
                  <div className="flex flex-col gap-2.5">
                    {planData.warningFlags.map((warning, idx) => (
                      <div
                        key={idx}
                        className="bg-error-container/30 border-l-[3px] border-error rounded-r-md px-3 py-2 flex items-start gap-2.5 shadow-sm"
                      >
                        <AlertTriangle className="w-4 h-4 text-secondary flex-shrink-0 mt-0.5" />
                        <span className="text-[14px] text-secondary font-sans leading-normal">
                          {warning}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* PRIORITY LIST */}
              <section className="space-y-4">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Weekly Priorities
                </h4>
                <div className="flex flex-col gap-4 bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-card">
                  {[...planData.prioritizedCommitments]
                    .sort((a, b) => a.priority - b.priority)
                    .map((item, idx) => (
                      <div key={item.commitmentId} className="flex gap-3 items-start">
                        <span className="text-[20px] font-extrabold text-primary font-sans leading-none mt-0.5">
                          {idx + 1}.
                        </span>
                        <div className="space-y-0.5">
                          <h5 className="text-[16px] font-bold text-on-surface font-sans leading-snug">
                            {getTitle(item.commitmentId)}
                          </h5>
                          <p className="text-[14px] text-on-surface-variant font-sans leading-relaxed">
                            {item.rationale}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </section>

              {/* LIFE DOMAIN ADVICE */}
              <section className="space-y-3">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Balance Advice
                </h4>
                <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-card p-4 flex items-start gap-3">
                  <Scale className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
                  <p className="text-[16px] text-on-surface font-sans leading-relaxed">
                    {planData.lifeDomainAdvice}
                  </p>
                </div>
              </section>

              {/* RESURFACED GOALS */}
              {planData.resurfacedGoals.length > 0 && (
                <section className="space-y-3">
                  <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                    Resurfaced Goals
                  </h4>
                  <div className="flex flex-col gap-3 bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
                    {planData.resurfacedGoals.map((goal, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <RefreshCw className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                        <span className="text-[15px] text-on-surface font-sans leading-normal">
                          {goal}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* REGENERATE ACTION */}
              <div className="pt-4 border-t border-outline-variant/30">
                <PillButton
                  variant="outline"
                  onClick={handleRegenerate}
                  className="w-full h-11 text-sm font-semibold tracking-wide"
                >
                  Regenerate Plan
                </PillButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Weekly Reflection Banner */}
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-5 shadow-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div className="space-y-1">
            <h4 className="text-base font-bold text-on-surface">Weekly Reflection</h4>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Reflect on your achievements and lessons from the past week to improve your scheduling intelligence.
            </p>
          </div>
          <button
            onClick={() => router.push("/reflection")}
            className="whitespace-nowrap px-5 py-2.5 bg-primary text-on-primary hover:bg-primary/90 font-semibold rounded-full text-xs transition duration-200"
          >
            Reflect on My Week
          </button>
        </div>

      </div>
    </NavShell>
  );
}
