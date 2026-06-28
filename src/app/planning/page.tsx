"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, Scale, RefreshCw, Loader2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PillButton } from "@/components/ui/pill-button";

export default function WeeklyPlanningPage() {
  const router = useRouter();
  const { user, userProfile } = useUserStore();

  const [generationState, setGenerationState] = useState<"idle" | "loading" | "ready">("idle");
  const [requiresReview, setRequiresReview] = useState(true);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleGenerate = () => {
    setGenerationState("loading");
    setTimeout(() => {
      setGenerationState("ready");
    }, 2000);
  };

  const handleRegenerate = () => {
    setGenerationState("loading");
    setTimeout(() => {
      setGenerationState("ready");
    }, 1500);
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  // Mock data values
  const mockDays = [
    { day: "Mon", title: "Read OS memory spec sheet", hours: "3.5 hrs", note: "Morning block" },
    { day: "Tue", title: "Write block headers structure", hours: "6.0 hrs", note: "High intensity" },
    { day: "Wed", title: "Sarah's birthday dinner", hours: "2.0 hrs", note: "Social block" },
    { day: "Thu", title: "Google recruiter session & mock", hours: "4.0 hrs", note: "Work block" },
    { day: "Fri", title: "Final OS submission details", hours: "2.5 hrs", note: "Deadline check" },
    { day: "Sat", title: "Focus session & review log notes", hours: "1.5 hrs", note: "Personal block" },
    { day: "Sun", title: "Weekly reflection & reset", hours: "1.0 hrs", note: "Reflection block" }
  ];

  const mockWarnings = [
    "Tuesday has 6 hours of high-concentration academic blocks. Monitor procrastination alerts.",
    "Google Recruiter session conflicts with personal cardio slot. Shifted cardio to Monday evening."
  ];

  const mockPriorities = [
    { num: 1, title: "OS Memory Assignment Submission", rationale: "Deadline is Friday. Completing the allocator by Tuesday ensures you have ample buffer for boundary testing." },
    { num: 2, title: "Google Recruiter Prep session", rationale: "Mock panels start Thursday. 4 hours of dedicated mock review is scheduled for Wednesday afternoon." },
    { num: 3, title: "Sarah's Birthday Dinner", rationale: "Scheduled for Wednesday. Ensure OS assignment core logic is compiled before attending." }
  ];

  const mockAdvice = [
    "Your social domain is well-balanced this week due to Sarah's birthday celebration. Avoid adding other micro-commitments in the academic sector until Wednesday's block is cleared."
  ];

  const mockResurfacedGoals = [
    "Read 1 research paper on garbage collection algorithms (resurfaced from Monthly goals)",
    "Update LinkedIn experience section details"
  ];

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-1/2 mx-auto px-6 py-8 flex flex-col gap-8 font-sans">
        
        {/* State Toggle checkbox for testing */}
        {generationState === "ready" && (
          <div className="bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant flex items-center justify-between text-xs text-on-surface-variant font-label">
            <span>Toggle Test Configuration:</span>
            <label className="flex items-center gap-2 cursor-pointer font-semibold select-none">
              <input
                type="checkbox"
                checked={requiresReview}
                onChange={(e) => setRequiresReview(e.target.checked)}
                className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              Mock requiresUserReview flag
            </label>
          </div>
        )}

        <AnimatePresence mode="wait">
          {generationState === "idle" && (
            /* PRE-GENERATION STATE */
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

              <PillButton
                variant="primary"
                onClick={handleGenerate}
                className="w-full max-w-[280px] h-[56px] text-[16px] font-semibold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <span>Generate My Week</span>
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
              {/* Spinner Header */}
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

          {generationState === "ready" && (
            /* POST-GENERATION STATE */
            <motion.div
              key="ready"
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="space-y-8"
            >
              {/* Requires User Review Banner */}
              {requiresReview && (
                <AmberReviewBanner message="Plan contains multiple high-stress periods on Tuesday and Wednesday evening. Review time slots manually." />
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
                  <ConfidenceBadge label="high" />
                </header>

                <div className="space-y-2">
                  <h3 className="text-[24px] font-bold text-on-surface font-sans leading-tight">
                    Focus on OS Allocator Assignment and Google Recruiter Mock Interviews
                  </h3>
                  <p className="text-[16px] text-on-surface-variant font-sans leading-relaxed">
                    This week requires high-intensity cognitive blocks. Deferring social calls to the weekend will keep your stress score below the 70% threshold.
                  </p>
                </div>
              </section>

              {/* DAY ROWS (Mon-Sun) */}
              <section className="space-y-3">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Daily Allocation
                </h4>
                <div>
                  {mockDays.map((day, idx) => (
                    <div
                      key={idx}
                      className="bg-surface-container-lowest rounded-md px-[14px] py-3 shadow-card mb-2 flex items-center justify-between gap-3 border border-outline-variant/20 hover:border-outline-variant/50 transition-colors"
                    >
                      <span className="text-[14px] font-bold text-on-surface font-sans w-10">
                        {day.day}
                      </span>
                      <span className="text-[14px] text-on-surface-variant font-sans flex-1 truncate">
                        {day.title}
                      </span>
                      <div className="flex flex-col items-end flex-shrink-0">
                        <span className="text-[12px] font-bold text-primary font-label">
                          {day.hours}
                        </span>
                        <span className="text-[11px] text-outline font-label mt-0.5">
                          {day.note}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* WARNING FLAGS (Watch Out) */}
              <section className="space-y-3">
                <h4 className="text-[14px] font-bold text-secondary font-sans pl-1">
                  Watch Out
                </h4>
                <div className="flex flex-col gap-2.5">
                  {mockWarnings.map((warning, idx) => (
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

              {/* PRIORITY LIST */}
              <section className="space-y-4">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Weekly Priorities
                </h4>
                <div className="flex flex-col gap-4 bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-card">
                  {mockPriorities.map((prio) => (
                    <div key={prio.num} className="flex gap-3 items-start">
                      <span className="text-[20px] font-extrabold text-primary font-sans leading-none mt-0.5">
                        {prio.num}.
                      </span>
                      <div className="space-y-0.5">
                        <h5 className="text-[16px] font-bold text-on-surface font-sans leading-snug">
                          {prio.title}
                        </h5>
                        <p className="text-[14px] text-on-surface-variant font-sans leading-relaxed">
                          {prio.rationale}
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
                    {mockAdvice[0]}
                  </p>
                </div>
              </section>

              {/* RESURFACED GOALS */}
              <section className="space-y-3">
                <h4 className="text-[14px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
                  Resurfaced Goals
                </h4>
                <div className="flex flex-col gap-3 bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
                  {mockResurfacedGoals.map((goal, idx) => (
                    <div key={idx} className="flex items-start gap-2.5">
                      <RefreshCw className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                      <span className="text-[15px] text-on-surface font-sans leading-normal">
                        {goal}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

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
      </div>
    </NavShell>
  );
}
