"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Lightbulb, ArrowRight, Activity, Loader2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { ConfidenceBadge } from "@/components/ui/confidence-badge";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { PillButton } from "@/components/ui/pill-button";

export default function WeeklyReflectionPage() {
  const router = useRouter();
  const { user, userProfile } = useUserStore();
  const { resolvedTheme } = useTheme();

  const [generationState, setGenerationState] = useState<"idle" | "loading" | "ready">(`idle`);
  const [completionRate, setCompletionRate] = useState(73);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Dynamic SVG Colors calculation
  const isDark = mounted && resolvedTheme === "dark";
  
  const getColors = (rate: number, dark: boolean) => {
    let arcColor = "";
    let trackColor = dark ? "#232630" : "#ECEEF1";
    let textClass = "";
    let tintClass = "";

    if (rate >= 70) {
      arcColor = dark ? "#4DDACF" : "#006761";
      textClass = "text-tertiary";
      tintClass = "bg-tertiary/8";
    } else if (rate >= 40) {
      arcColor = dark ? "#FFB870" : "#8F4D00";
      textClass = "text-secondary";
      tintClass = "bg-secondary/8";
    } else {
      arcColor = dark ? "#FFB4AB" : "#BA1A1A";
      textClass = "text-error";
      tintClass = "bg-error/8";
    }

    return { arcColor, trackColor, textClass, tintClass };
  };

  const { arcColor, trackColor, textClass, tintClass } = getColors(completionRate, isDark);

  // Circular progress dimensions
  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.99
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  const mockPatterns = [
    "Tasks scheduled between 9:00 AM and 11:30 AM completed 90% of the time.",
    "Procrastination alerts spiked on Tuesday afternoons during academic blocks."
  ];

  return (
    <NavShell displayName={displayName}>
      <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8 font-sans">
        
        {/* Test Control panel */}
        {generationState === "ready" && (
          <div className="bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-on-surface-variant font-label">
            <span>Test Completion Arc Colors:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setCompletionRate(73)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  completionRate === 73 ? "bg-primary text-on-primary" : "bg-surface-container-highest"
                }`}
              >
                73% (Teal)
              </button>
              <button
                onClick={() => setCompletionRate(55)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  completionRate === 55 ? "bg-primary text-on-primary" : "bg-surface-container-highest"
                }`}
              >
                55% (Amber)
              </button>
              <button
                onClick={() => setCompletionRate(32)}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  completionRate === 32 ? "bg-primary text-on-primary" : "bg-surface-container-highest"
                }`}
              >
                32% (Red)
              </button>
            </div>
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
                ✨
              </div>
              
              <div className="space-y-2 max-w-[320px]">
                <h2 className="text-[24px] font-bold text-on-surface leading-tight tracking-tight">
                  Generate Weekly Reflection
                </h2>
                <p className="text-[16px] text-on-surface-variant leading-relaxed">
                  Evaluate your stress threshold, commitments completed, and time blocks optimized this week.
                </p>
              </div>

              <PillButton
                variant="primary"
                onClick={handleGenerate}
                className="w-full max-w-[280px] h-[56px] text-[16px] font-semibold flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                <span>Generate My Reflection</span>
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
                  Gemini is compiling your reflection...
                </span>
              </div>
              <SkeletonRow height={160} />
              <SkeletonRow height={120} />
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
              
              {/* COMPLETION RATE CIRCLE SECTION */}
              <section className="flex flex-col items-center text-center gap-4 py-4">
                <div className="relative w-[160px] h-[160px] mx-auto flex items-center justify-center">
                  
                  {/* Radial tint */}
                  <div className={`absolute inset-2 rounded-full ${tintClass} blur-md opacity-20 transition-all duration-300`} />

                  {/* SVG Arc Progress */}
                  <svg width="160" height="160" className="relative z-10">
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={trackColor}
                      strokeWidth="10"
                      className="transition-colors duration-300"
                    />
                    <motion.circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke={arcColor}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      initial={{ strokeDashoffset: circumference }}
                      animate={{ strokeDashoffset }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      strokeLinecap="round"
                      transform="rotate(-90 80 80)"
                      className="transition-colors duration-300"
                    />
                  </svg>

                  {/* Inside Label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                    <span className={`text-[32px] font-extrabold font-sans leading-none ${textClass} transition-colors duration-300`}>
                      {completionRate}%
                    </span>
                  </div>
                </div>

                <div className="space-y-0.5">
                  <p className="text-[16px] text-on-surface-variant font-sans max-w-[240px] mx-auto leading-normal">
                    of commitments completed this week
                  </p>
                </div>
              </section>

              {/* NARRATIVE CARD */}
              <section className="bg-surface-container-lowest rounded-[24px] shadow-card p-5 border border-outline-variant/30">
                <span className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase">
                  This Week
                </span>
                <p className="text-[16px] text-on-surface font-sans leading-[1.7] mt-2">
                  You successfully navigated the heavy exam preparation blocks on Tuesday and cleared your OS allocator prototype codes. Postponing two optional sync panels preserved key calendar spaces, leading to a healthy 73% completion record.
                </p>
              </section>

              {/* TOP INSIGHT CARD (Teal styling) */}
              <section className="bg-tertiary/8 border border-tertiary/30 rounded-xl p-5 flex items-start gap-3 shadow-sm">
                <Lightbulb className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[12px] font-semibold font-label text-tertiary tracking-wider uppercase leading-none">
                    Key Insight
                  </span>
                  <p className="text-[16px] font-semibold text-on-surface font-sans leading-relaxed">
                    Protecting 9:00 AM to 11:30 AM blocks resulted in 90% of your academic milestones being met this week.
                  </p>
                </div>
              </section>

              {/* NEXT WEEK BLOCK */}
              <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 flex items-start gap-3 shadow-card">
                <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[12px] font-semibold font-label text-primary tracking-wider uppercase leading-none">
                    Next Week
                  </span>
                  <p className="text-[16px] font-semibold text-on-surface font-sans leading-relaxed">
                    Lock mid-morning blocks on Monday and Tuesday to prepare for your Google mock technical rounds.
                  </p>
                </div>
              </section>

              {/* PATTERNS OBSERVED */}
              <section className="space-y-3">
                <h4 className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase pl-1">
                  Patterns Observed
                </h4>
                <div className="flex flex-col gap-2.5">
                  {mockPatterns.map((pattern, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.06 }}
                      className="flex items-start gap-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 shadow-sm"
                    >
                      <Activity className="w-4 h-4 text-primary-container flex-shrink-0 mt-0.5" />
                      <span className="text-[14px] text-on-surface font-sans leading-normal">
                        {pattern}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* MOTIVATIONAL MESSAGE */}
              <section className="bg-surface-container-low rounded-lg p-6 relative flex flex-col items-center justify-center text-center">
                <span className="text-[48px] font-serif text-primary leading-none h-6 select-none">“</span>
                <p className="italic text-[18px] text-on-surface font-sans leading-relaxed px-4">
                  You had a highly productive week despite the tight academic schedule. Protecting your rest slots will build long-term momentum.
                </p>
                <span className="text-[48px] font-serif text-primary leading-none h-6 mt-2 select-none">”</span>
              </section>

              {/* Confidence Badge Footer */}
              <div className="flex flex-col items-center justify-center pt-2">
                <span className="text-[11px] font-semibold text-outline uppercase tracking-wider mb-1 font-label">
                  AI Confidence Level
                </span>
                <ConfidenceBadge label="high" />
              </div>

              {/* REGENERATE ACTION */}
              <div className="pt-4 border-t border-outline-variant/30">
                <PillButton
                  variant="outline"
                  onClick={handleRegenerate}
                  className="w-full h-11 text-sm font-semibold tracking-wide"
                >
                  Regenerate Reflection
                </PillButton>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </NavShell>
  );
}
