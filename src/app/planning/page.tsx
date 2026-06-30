"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, AlertTriangle, Scale, RefreshCw, Loader2, ArrowLeft, Lightbulb, ArrowRight, Activity, Calendar, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
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

interface WeeklyReflectionResponse {
  completionRate: number;
  narrative: string;
  patternsObserved: string[];
  topInsight: string;
  nextWeekRecommendation: string;
  motivationalMessage: string;
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
  const { user, setUser, userProfile, subscribeToUserProfile } = useUserStore();
  const { commitments, subscribeToCommitments } = useCommitmentsStore();
  const { resolvedTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<"reflection" | "plan">("reflection");
  const [mounted, setMounted] = useState(false);

  // Reflection States
  const [reflectionState, setReflectionState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [reflectionData, setReflectionData] = useState<WeeklyReflectionResponse | null>(null);
  const [reflectionError, setReflectionError] = useState<string | null>(null);
  const [completionRate, setCompletionRate] = useState(0);

  // Plan States
  const [planState, setPlanState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [planData, setPlanData] = useState<WeeklyPlanResponse | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);

  // Cascade Rebalance States (TASK 5.1-A)
  const [replanState, setReplanState] = useState<"idle" | "loading" | "ready" | "applying" | "success" | "error">("idle");
  const [replanData, setReplanData] = useState<any | null>(null);
  const [replanError, setReplanError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  // Firestore User Profile Subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProfile(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToUserProfile]);

  // Firestore Commitments Subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCommitments(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToCommitments]);

  // Load cached reflection/plan from userProfile on mount/load
  useEffect(() => {
    if (userProfile) {
      if (userProfile.lastWeeklyReflection) {
        setReflectionData(userProfile.lastWeeklyReflection);
        setReflectionState("ready");
        setCompletionRate(userProfile.lastWeeklyReflection.completionRate || 0);
      }
      if (userProfile.lastWeeklyPlan) {
        setPlanData(userProfile.lastWeeklyPlan);
        setPlanState("ready");
      }
    }
  }, [userProfile]);

  // Trigger SVG Arc Animation when data arrives
  useEffect(() => {
    if (!reflectionData) return;
    setCompletionRate(reflectionData.completionRate);
  }, [reflectionData?.completionRate]);

  // Generate Reflection Handler
  const handleGenerateReflection = async () => {
    if (!user) return;
    setReflectionState("loading");
    setReflectionError(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Triggering /api/ai/weekly-reflection for user:", user.uid);
      const res = await fetch("/api/ai/weekly-reflection", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] Weekly reflection generated:", data);
      setReflectionData(data);
      setReflectionState("ready");
    } catch (e: any) {
      console.error("[Frontend] handleGenerateReflection failed:", e);
      setReflectionError(e.message ?? "Reflection generation failed. Try again.");
      setReflectionState("error");
    }
  };

  // Generate Plan Handler
  const handleGeneratePlan = async () => {
    if (!user) return;
    setPlanState("loading");
    setPlanError(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Triggering /api/ai/weekly-planning for user:", user.uid);
      const res = await fetch("/api/ai/weekly-planning", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] Plan generated successfully:", data);
      setPlanData(data);
      setPlanState("ready");
    } catch (e: any) {
      console.error("[Frontend] handleGeneratePlan failed:", e);
      setPlanError(e.message ?? "Plan generation failed. Try again.");
      setPlanState("error");
    }
  };

  const handleRegenerateReflection = () => {
    setReflectionData(null);
    setCompletionRate(0);
    setReflectionState("idle");
  };

  const handleRegeneratePlan = () => {
    setPlanData(null);
    setPlanState("idle");
  };

  // Rebalance Trigger (TASK 5.1-A)
  const handleTriggerRebalance = async () => {
    if (!user) return;
    setReplanState("loading");
    setReplanError(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Triggering /api/ai/replan-cascade for user:", user.uid);
      const res = await fetch("/api/ai/replan-cascade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] Cascade replanning completed:", data);
      setReplanData(data);
      setReplanState("ready");
    } catch (e: any) {
      console.error("[Frontend] handleTriggerRebalance failed:", e);
      setReplanError(e.message ?? "Weekly re-balancing failed. Try again.");
      setReplanState("error");
    }
  };

  // Rebalance Apply (TASK 5.1-A)
  const handleApplyRebalance = async () => {
    if (!user || !replanData || !replanData.adjustments || replanData.adjustments.length === 0) return;
    setReplanState("applying");
    setReplanError(null);
    try {
      const idToken = await user.getIdToken();
      console.log("[Frontend] Applying adjustments with /api/calendar/reallocate-blocks for user:", user.uid);
      const res = await fetch("/api/calendar/reallocate-blocks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          userId: user.uid,
          adjustments: replanData.adjustments
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      console.log("[Frontend] Adjustments applied successfully:", data);
      setReplanState("success");
    } catch (e: any) {
      console.error("[Frontend] handleApplyRebalance failed:", e);
      setReplanError(e.message ?? "Applying schedule adjustments failed. Try again.");
      setReplanState("error");
    }
  };

  const handleResetRebalance = () => {
    setReplanData(null);
    setReplanState("idle");
    setReplanError(null);
  };

  const formatBlockTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + " (" + d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ")";
  };

  const getTitle = (id: string | null | undefined) => {
    if (!id) return "General Focus";
    return commitments.find((c) => c.id === id)?.title ?? `Commitment ${id.slice(0, 6)}`;
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  // Dynamic SVG Colors calculation for Reflection Tab
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
  const radius = 50;

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-1/2 mx-auto px-6 py-8 flex flex-col gap-6 font-sans">
        
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
            Weekly Alignment Hub
          </h1>
          <p className="text-sm text-on-surface-variant">
            Reflect on the past week and calibrate your schedules for next week.
          </p>
        </header>

        {/* Tabbed Navigation Header */}
        <div className="flex border-b border-outline-variant/30 w-full relative">
          <button
            onClick={() => setActiveTab("reflection")}
            className={`flex-1 pb-3 text-center text-[15px] font-bold transition-all relative ${
              activeTab === "reflection" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>1. Reflection</span>
            {activeTab === "reflection" && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("plan")}
            className={`flex-1 pb-3 text-center text-[15px] font-bold transition-all relative ${
              activeTab === "plan" ? "text-primary" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <span>2. Weekly Plan</span>
            {activeTab === "plan" && (
              <motion.div
                layoutId="active-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[3px] bg-primary"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        </div>

        {/* Animate Tab Content Switching */}
        <AnimatePresence mode="wait">
          {activeTab === "reflection" ? (
            <motion.div
              key="reflection-tab"
              initial={{ x: -15, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 15, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {(reflectionState === "idle" || reflectionState === "error") && (
                <div className="flex flex-col items-center justify-center text-center py-12 gap-6">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl shadow-sm select-none">
                    ✨
                  </div>
                  <div className="space-y-2 max-w-[340px]">
                    <h2 className="text-[22px] font-bold text-on-surface leading-tight tracking-tight">
                      Generate Weekly Reflection
                    </h2>
                    <p className="text-[15px] text-on-surface-variant leading-relaxed">
                      Evaluate your completed commitments, stress coefficients, and schedule accuracy.
                    </p>
                  </div>
                  {reflectionState === "error" && reflectionError && (
                    <div className="flex items-center gap-2.5 p-4 bg-error-container text-on-error-container rounded-xl text-[14px] font-semibold w-full max-w-[320px] border border-error/20">
                      <AlertTriangle className="w-4.5 h-4.5 text-error flex-shrink-0" />
                      <span>{reflectionError}</span>
                    </div>
                  )}
                  <PillButton
                    variant={reflectionState === "error" ? "outline" : "primary"}
                    onClick={handleGenerateReflection}
                    className="w-full max-w-[260px] h-[52px] text-[15px] font-semibold flex items-center justify-center gap-2"
                  >
                    {reflectionState !== "error" && <Sparkles className="w-5 h-5 flex-shrink-0" />}
                    <span>{reflectionState === "error" ? "Try Again" : "Generate Reflection"}</span>
                  </PillButton>
                </div>
              )}

              {reflectionState === "loading" && (
                <div className="space-y-6 py-6">
                  <div className="flex flex-col items-center justify-center text-center gap-2.5 pb-4">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-[16px] font-bold text-on-surface leading-none">
                      Gemini is compiling your weekly reflection...
                    </span>
                  </div>
                  <SkeletonRow height={160} />
                  <SkeletonRow height={120} />
                  <SkeletonRow height={80} />
                </div>
              )}

              {reflectionState === "ready" && reflectionData && (
                <div className="space-y-6">
                  {/* Amber Review Banner */}
                  {(reflectionData.requiresUserReview || (reflectionData.aiMeta?.confidence !== undefined && reflectionData.aiMeta.confidence < 0.5)) && (
                    <AmberReviewBanner message={reflectionData.reviewReason ?? `Low AI Confidence (${Math.round((reflectionData.aiMeta?.confidence ?? 0) * 100)}%): ${reflectionData.aiMeta?.reasoning}`} />
                  )}

                  {/* Completion Rate Circle Chart & Stats Grid */}
                  <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-card flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative w-[120px] h-[120px] flex-shrink-0 flex items-center justify-center">
                      <div className={`absolute inset-2 rounded-full ${tintClass} blur-md opacity-25 transition-all duration-300`} />
                      <svg width="120" height="120" className="relative z-10">
                        <circle cx="60" cy="60" r="50" fill="transparent" stroke={trackColor} strokeWidth="6" className="transition-colors duration-300" />
                        <motion.circle
                          cx="60" cy="60" r="50" fill="transparent" stroke={arcColor} strokeWidth="6"
                          strokeDasharray={2 * Math.PI * 50}
                          initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 50 - (completionRate / 100) * (2 * Math.PI * 50) }}
                          transition={{ duration: 0.8, ease: "easeOut" }}
                          strokeLinecap="round" transform="rotate(-90 60 60)"
                          className="transition-colors duration-300"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <span className={`text-[24px] font-black leading-none ${textClass} transition-colors duration-300`}>
                          {completionRate}%
                        </span>
                        <span className="text-[10px] text-outline font-bold mt-0.5">Rate</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      <h4 className="text-[12px] font-extrabold text-outline uppercase tracking-wider">
                        Weekly Metrics
                      </h4>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                            Streak
                          </span>
                          <span className="text-[15px] font-black text-primary mt-0.5">
                            {userProfile?.stats?.currentStreak ?? 0}d
                          </span>
                        </div>
                        <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                            Done
                          </span>
                          <span className="text-[15px] font-black text-tertiary mt-0.5">
                            {userProfile?.stats?.totalCompleted ?? 0}/{userProfile?.stats?.totalCommitmentsCreated ?? 0}
                          </span>
                        </div>
                        <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                          <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                            Stress
                          </span>
                          <span className="text-[15px] font-black text-secondary mt-0.5">
                            {userProfile?.stats?.stressScore ?? 0}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Narrative Card */}
                  <section className="bg-surface-container-lowest rounded-2xl shadow-card p-5 border border-outline-variant/30">
                    <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                      This Week's Narrative
                    </span>
                    <p className="text-[14.5px] text-on-surface font-sans leading-[1.6] mt-2">
                      {reflectionData.narrative}
                    </p>
                  </section>

                  {/* Top Insight */}
                  <section className="bg-tertiary/8 border border-tertiary/20 rounded-xl p-4 flex items-start gap-3 shadow-sm">
                    <Lightbulb className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-tertiary uppercase tracking-wider leading-none">
                        Key Insight
                      </span>
                      <p className="text-[14px] text-on-surface font-sans leading-normal">
                        {reflectionData.topInsight}
                      </p>
                    </div>
                  </section>

                  {/* Next Week Advice */}
                  <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 flex items-start gap-3 shadow-card">
                    <ArrowRight className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <span className="text-[11px] font-semibold text-primary uppercase tracking-wider leading-none">
                        Next Week Recommendation
                      </span>
                      <p className="text-[14px] text-on-surface font-sans leading-normal">
                        {reflectionData.nextWeekRecommendation}
                      </p>
                    </div>
                  </section>

                  {/* Patterns */}
                  {reflectionData.patternsObserved.length > 0 && (
                    <section className="space-y-2">
                      <h4 className="text-[11px] font-semibold text-outline uppercase tracking-wider pl-1">
                        Patterns Observed
                      </h4>
                      <div className="flex flex-col gap-2">
                        {reflectionData.patternsObserved.map((pattern, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 bg-surface-container-lowest border border-outline-variant/20 rounded-lg p-3 shadow-sm">
                            <Activity className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                            <span className="text-[13.5px] text-on-surface font-sans leading-normal">
                              {pattern}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Motivational Quote */}
                  <section className="bg-surface-container-low rounded-lg p-5 relative flex flex-col items-center justify-center text-center">
                    <span className="text-[32px] font-serif text-primary leading-none h-4 select-none">“</span>
                    <p className="italic text-[15px] text-on-surface font-sans leading-relaxed px-4">
                      {reflectionData.motivationalMessage}
                    </p>
                    <span className="text-[32px] font-serif text-primary leading-none h-4 mt-1 select-none">”</span>
                  </section>

                  {/* E2E Transition CTA Button (The connector) */}
                  <div className="pt-4 border-t border-outline-variant/30 flex flex-col gap-3">
                    <PillButton
                      variant="primary"
                      onClick={() => setActiveTab("plan")}
                      className="w-full h-12 text-[14.5px] font-bold flex items-center justify-center gap-2 shadow-md"
                    >
                      <span>Looks good, let's plan next week</span>
                      <ArrowRight className="w-4 h-4 flex-shrink-0" />
                    </PillButton>

                    <PillButton
                      variant="outline"
                      onClick={handleRegenerateReflection}
                      className="w-full h-11 text-xs font-semibold"
                    >
                      Regenerate Reflection
                    </PillButton>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="plan-tab"
              initial={{ x: 15, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -15, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {(planState === "idle" || planState === "error") && (
                <div className="flex flex-col items-center justify-center text-center py-12 gap-6">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl shadow-sm select-none">
                    📅
                  </div>
                  <div className="space-y-2 max-w-[340px]">
                    <h2 className="text-[22px] font-bold text-on-surface leading-tight tracking-tight">
                      Generate Weekly Plan
                    </h2>
                    <p className="text-[15px] text-on-surface-variant leading-relaxed">
                      Analyze calendar openings and set your daily priority allocations.
                    </p>
                  </div>
                  {planState === "error" && planError && (
                    <div className="flex items-center gap-2.5 p-4 bg-error-container text-on-error-container rounded-xl text-[14px] font-semibold w-full max-w-[320px] border border-error/20">
                      <AlertTriangle className="w-4.5 h-4.5 text-error flex-shrink-0" />
                      <span>{planError}</span>
                    </div>
                  )}
                  <PillButton
                    variant={planState === "error" ? "outline" : "primary"}
                    onClick={handleGeneratePlan}
                    className="w-full max-w-[260px] h-[52px] text-[15px] font-semibold flex items-center justify-center gap-2"
                  >
                    {planState !== "error" && <Sparkles className="w-5 h-5 flex-shrink-0" />}
                    <span>{planState === "error" ? "Try Again" : "Generate Weekly Plan"}</span>
                  </PillButton>
                </div>
              )}

              {planState === "loading" && (
                <div className="space-y-6 py-6">
                  <div className="flex flex-col items-center justify-center text-center gap-2.5 pb-4">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-[16px] font-bold text-on-surface leading-none">
                      Gemini is compiling your weekly plan...
                    </span>
                  </div>
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                  <SkeletonRow height={80} />
                </div>
              )}

              {planState === "ready" && planData && (
                <div className="space-y-6">
                  {/* Amber Review Banner */}
                  {(planData.requiresUserReview || (planData.aiMeta?.confidence !== undefined && planData.aiMeta.confidence < 0.5)) && (
                    <AmberReviewBanner message={planData.reviewReason ?? `Low AI Confidence (${Math.round((planData.aiMeta?.confidence ?? 0) * 100)}%): ${planData.aiMeta?.reasoning}`} />
                  )}

                  {/* Weekly Plan Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-surface-container-lowest rounded-2xl p-4 border border-outline-variant/30 shadow-card">
                    <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                      <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                        Active Tasks
                      </span>
                      <span className="text-[15px] font-black text-primary mt-0.5">
                        {commitments.filter(c => c.status === "active").length} Tasks
                      </span>
                    </div>
                    <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                      <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                        Focus Span
                      </span>
                      <span className="text-[15px] font-black text-tertiary mt-0.5">
                        {userProfile?.learningCoefficients?.averageAttentionSpanMinutes ?? 35}m
                      </span>
                    </div>
                    <div className="bg-surface-container-low rounded-xl p-2.5 text-center border border-outline-variant/10 shadow-sm flex flex-col justify-center">
                      <span className="text-[10px] font-extrabold text-outline uppercase tracking-widest block">
                        Work Mult.
                      </span>
                      <span className="text-[15px] font-black text-secondary mt-0.5">
                        {userProfile?.learningCoefficients?.domainEffortMultipliers?.work ?? "1.0"}x
                      </span>
                    </div>
                  </div>

                  {/* Weekly Intention Card */}
                  <section className="bg-surface-container-lowest rounded-[20px] shadow-modal p-5 relative overflow-hidden pt-7 border border-outline-variant/30 flex flex-col gap-3">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-primary-container" />
                    <header className="flex justify-between items-start w-full gap-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
                        <span className="text-[11px] font-semibold text-primary uppercase tracking-wider">
                          Weekly Intention
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
                    <div className="space-y-1.5">
                      <h3 className="text-[18px] font-bold text-on-surface font-sans leading-tight">
                        {planData.weeklyIntention}
                      </h3>
                      <p className="text-[14px] text-on-surface-variant font-sans leading-relaxed">
                        {planData.weekSummary}
                      </p>
                    </div>
                  </section>

                  {/* Global Multi-Commitment Re-balancing Engine (TASK 5.1-A) */}
                  <section className="bg-surface-container-lowest rounded-[20px] shadow-modal border border-outline-variant/30 overflow-hidden relative p-6 flex flex-col gap-4">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-secondary to-tertiary" />
                    
                    <header className="flex justify-between items-start gap-4">
                      <div className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-secondary flex-shrink-0 animate-pulse" />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-secondary uppercase tracking-wider">
                            Global Week Calibrator
                          </span>
                          <h3 className="text-md font-bold text-on-surface">
                            Multi-Commitment Cascade Optimizer
                          </h3>
                        </div>
                      </div>
                      
                      {replanState === "ready" && replanData?.aiMeta?.confidenceLabel && (
                        <ConfidenceBadge label={replanData.aiMeta.confidenceLabel} />
                      )}
                    </header>

                    {replanState === "idle" && (
                      <div className="space-y-4">
                        <p className="text-[13.5px] text-on-surface-variant leading-relaxed font-sans">
                          Your weekly calendar blocks can get cluttered with overlaps and missed deadlines as priorities shift. Run our global rebalancing engine to automatically detect conflicts, align blocks with your <strong>attention span ({userProfile?.learningCoefficients?.averageAttentionSpanMinutes ?? 35} mins)</strong>, factor in underestimation risks, and distribute tasks smoothly into preferred slots.
                        </p>
                        <PillButton
                          variant="primary"
                          onClick={handleTriggerRebalance}
                          className="w-full h-11 text-[13.5px] font-bold flex items-center justify-center gap-2 hover:scale-[1.01] transition-transform duration-200"
                        >
                          <RefreshCw className="w-4 h-4 flex-shrink-0" />
                          <span>Optimize Calendar & Resolve Overlaps</span>
                        </PillButton>
                      </div>
                    )}

                    {replanState === "loading" && (
                      <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                        <Loader2 className="w-8 h-8 text-secondary animate-spin" />
                        <div className="space-y-1">
                          <p className="text-[14px] font-bold text-on-surface">
                            Recalibrating Weekly Commitments...
                          </p>
                          <p className="text-xs text-on-surface-variant animate-pulse">
                            Gemini is running global collision-avoidance checks
                          </p>
                        </div>
                      </div>
                    )}

                    {replanState === "ready" && replanData && (
                      <div className="space-y-4">
                        {/* Summary / Reasoning from AI */}
                        <div className="bg-surface-container-low rounded-xl p-3.5 border border-outline-variant/20">
                          <p className="text-[13.5px] text-on-surface leading-relaxed font-sans">
                            {replanData.summary}
                          </p>
                        </div>

                        {/* Amber Review Banner for Rebalance */}
                        {(replanData.requiresUserReview || (replanData.aiMeta?.confidence !== undefined && replanData.aiMeta.confidence < 0.5)) && (
                          <AmberReviewBanner message={replanData.reviewReason ?? `Low AI Confidence (${Math.round((replanData.aiMeta?.confidence ?? 0) * 100)}%): ${replanData.aiMeta?.reasoning}`} />
                        )}

                        {/* If no adjustments needed (zero schedule churn rule) */}
                        {(!replanData.adjustments || replanData.adjustments.length === 0) ? (
                          <div className="bg-tertiary/10 border border-tertiary/20 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <h4 className="text-[13px] font-bold text-tertiary uppercase tracking-wide leading-none">
                                Perfectly Aligned!
                              </h4>
                              <p className="text-[13px] text-on-surface font-sans leading-relaxed">
                                No scheduling conflicts, overlaps, or capacity breaches detected. Your current calendar setup is fully balanced for the week!
                              </p>
                            </div>
                          </div>
                        ) : (
                          // If adjustments are suggested
                          <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                              <span className="text-[11px] font-semibold text-outline uppercase tracking-wider">
                                Proposed Shifts ({replanData.adjustments.length})
                              </span>
                              <span className="text-[11px] font-bold text-secondary-container bg-secondary/15 px-2 py-0.5 rounded-full">
                                Avoids Churn
                              </span>
                            </div>

                            {/* Scrollable list of proposed block shifts */}
                            <div className="max-h-[220px] overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
                              <AnimatePresence>
                                {replanData.adjustments.map((adj: any, idx: number) => (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="bg-surface-container-low hover:bg-surface-container-high transition-colors rounded-xl p-3 border border-outline-variant/10 shadow-sm flex flex-col gap-2"
                                  >
                                    <div className="flex justify-between items-center gap-2">
                                      <span className="text-[13.5px] font-bold text-on-surface truncate">
                                        {adj.commitmentTitle}
                                      </span>
                                      <span className="text-[10px] font-extrabold text-outline uppercase bg-surface-container-lowest px-2 py-0.5 rounded border border-outline-variant/10">
                                        Shift
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                                      <div className="bg-surface-container-lowest p-2 rounded-lg border border-error/10">
                                        <span className="text-[9px] font-extrabold text-error uppercase tracking-widest block mb-0.5">Original</span>
                                        <span className="text-on-surface-variant font-medium leading-none block truncate">
                                          {formatBlockTime(adj.originalBlock.start)}
                                        </span>
                                      </div>

                                      <ArrowRightLeft className="w-3.5 h-3.5 text-outline" />

                                      <div className="bg-surface-container-lowest p-2 rounded-lg border border-tertiary/20">
                                        <span className="text-[9px] font-extrabold text-tertiary uppercase tracking-widest block mb-0.5">Proposed</span>
                                        <span className="text-primary font-bold leading-none block truncate">
                                          {formatBlockTime(adj.proposedBlock.start)}
                                        </span>
                                      </div>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </div>
                        )}

                        {/* Actions for ready state */}
                        <div className="pt-3 border-t border-outline-variant/20 flex gap-2">
                          {replanData.adjustments && replanData.adjustments.length > 0 && (
                            <PillButton
                              variant="primary"
                              onClick={handleApplyRebalance}
                              className="flex-1 h-10 text-[13px] font-bold flex items-center justify-center gap-1.5 animate-pulse"
                            >
                              <span>Apply Changes</span>
                            </PillButton>
                          )}
                          <PillButton
                            variant="outline"
                            onClick={handleResetRebalance}
                            className="flex-1 h-10 text-[13px] font-bold"
                          >
                            <span>{replanData.adjustments && replanData.adjustments.length > 0 ? "Cancel" : "Done"}</span>
                          </PillButton>
                        </div>
                      </div>
                    )}

                    {replanState === "applying" && (
                      <div className="flex flex-col items-center justify-center text-center py-6 gap-3">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <div className="space-y-1">
                          <p className="text-[14px] font-bold text-on-surface">
                            Executing Batch Rescheduling...
                          </p>
                          <p className="text-xs text-on-surface-variant animate-pulse">
                            Writing atomic database and Google Calendar events...
                          </p>
                        </div>
                      </div>
                    )}

                    {replanState === "success" && (
                      <div className="flex flex-col items-center justify-center text-center py-6 gap-4">
                        <div className="w-12 h-12 bg-tertiary/10 text-tertiary rounded-full flex items-center justify-center text-xl shadow-sm">
                          🎉
                        </div>
                        <div className="space-y-1 max-w-[320px]">
                          <p className="text-[15px] font-black text-on-surface leading-tight">
                            Calendar Successfully Calibrated!
                          </p>
                          <p className="text-xs text-on-surface-variant leading-relaxed font-sans">
                            Your commitments have been rescheduled seamlessly on Google Calendar and Firestore. Overlaps are resolved, and dashboard stress levels have been updated!
                          </p>
                        </div>
                        <PillButton
                          variant="primary"
                          onClick={handleResetRebalance}
                          className="w-full max-w-[160px] h-9 text-xs font-bold"
                        >
                          Dismiss
                        </PillButton>
                      </div>
                    )}

                    {replanState === "error" && (
                      <div className="space-y-4">
                        <div className="flex items-start gap-2.5 p-3 bg-error-container text-on-error-container rounded-xl text-xs font-medium border border-error/20">
                          <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                          <div className="space-y-0.5">
                            <span className="font-bold block">Rebalancing Failed</span>
                            <span className="opacity-90">{replanError}</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <PillButton
                            variant="primary"
                            onClick={handleTriggerRebalance}
                            className="flex-1 h-9 text-xs font-bold"
                          >
                            Try Again
                          </PillButton>
                          <PillButton
                            variant="outline"
                            onClick={handleResetRebalance}
                            className="flex-1 h-9 text-xs font-bold"
                          >
                            Cancel
                          </PillButton>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Daily Focus Timeline */}
                  <section className="space-y-3">
                    <h4 className="text-[12px] font-semibold text-outline uppercase tracking-wider pl-1">
                      Daily Focus Timeline
                    </h4>
                    <div className="space-y-3">
                      {planData.recommendedDailyFocus.map((day, idx) => (
                        <div
                          key={idx}
                          className="bg-surface-container-lowest rounded-xl p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-2 hover:border-outline-variant/50 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[14px] font-bold text-on-surface font-sans w-24">
                              {day.day}
                            </span>
                            <span className="text-[14px] font-semibold text-primary font-sans flex-1 truncate">
                              {getTitle(day.primaryCommitmentId)}
                            </span>
                            <span className="text-[12px] font-extrabold text-primary font-label bg-primary/10 px-2.5 py-1 rounded-full flex-shrink-0">
                              {day.suggestedHours} hrs
                            </span>
                          </div>
                          {day.note && (
                            <p className="text-[13px] text-on-surface-variant font-sans leading-relaxed">
                              {day.note}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Warning Flags */}
                  {planData.warningFlags.length > 0 && (
                    <section className="space-y-2">
                      <h4 className="text-[12px] font-semibold text-error uppercase tracking-wider pl-1">
                        Watch Out
                      </h4>
                      <div className="flex flex-col gap-2">
                        {planData.warningFlags.map((warning, idx) => (
                          <div key={idx} className="bg-error-container/30 border-l-[3px] border-error rounded-r-md px-3 py-2 flex items-start gap-2 shadow-sm">
                            <AlertTriangle className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                            <span className="text-[13.5px] text-on-error-container font-sans leading-normal">
                              {warning}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Weekly Priorities */}
                  <section className="space-y-3">
                    <h4 className="text-[12px] font-semibold text-outline uppercase tracking-wider pl-1">
                      Weekly Priorities
                    </h4>
                    <div className="flex flex-col gap-4 bg-surface-container-lowest rounded-xl p-5 border border-outline-variant/30 shadow-card">
                      {[...planData.prioritizedCommitments]
                        .sort((a, b) => a.priority - b.priority)
                        .map((item, idx) => (
                          <div key={item.commitmentId} className="flex gap-3 items-start">
                            <span className="text-[18px] font-extrabold text-primary font-sans leading-none mt-0.5">
                              {idx + 1}.
                            </span>
                            <div className="space-y-0.5">
                              <h5 className="text-[15px] font-bold text-on-surface font-sans leading-snug">
                                {getTitle(item.commitmentId)}
                              </h5>
                              <p className="text-[13.5px] text-on-surface-variant font-sans leading-relaxed">
                                {item.rationale}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </section>

                  {/* Balance Advice */}
                  <section className="space-y-2">
                    <h4 className="text-[12px] font-semibold text-outline uppercase tracking-wider pl-1">
                      Balance Advice
                    </h4>
                    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-card p-4 flex items-start gap-3">
                      <Scale className="w-5 h-5 text-tertiary flex-shrink-0 mt-0.5" />
                      <p className="text-[14px] text-on-surface font-sans leading-relaxed">
                        {planData.lifeDomainAdvice}
                      </p>
                    </div>
                  </section>

                  {/* Resurfaced Goals */}
                  {planData.resurfacedGoals.length > 0 && (
                    <section className="space-y-2">
                      <h4 className="text-[12px] font-semibold text-outline uppercase tracking-wider pl-1">
                        Resurfaced Goals
                      </h4>
                      <div className="flex flex-col gap-2.5 bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/30 shadow-card">
                        {planData.resurfacedGoals.map((goal, idx) => (
                          <div key={idx} className="flex items-start gap-2.5">
                            <RefreshCw className="w-4 h-4 text-primary flex-shrink-0 mt-1" />
                            <span className="text-[13.5px] text-on-surface font-sans leading-normal">
                              {goal}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  {/* Regenerate Button */}
                  <div className="pt-4 border-t border-outline-variant/30">
                    <PillButton
                      variant="outline"
                      onClick={handleRegeneratePlan}
                      className="w-full h-11 text-xs font-semibold"
                    >
                      Regenerate Plan
                    </PillButton>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </NavShell>
  );
}
