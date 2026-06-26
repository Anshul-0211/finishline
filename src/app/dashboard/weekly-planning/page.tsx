"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { startOfWeek, format, formatDistanceToNow } from "date-fns";
import { 
  Calendar, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Compass, 
  RefreshCw,
  Loader2,
  Lock
} from "lucide-react";

interface PrioritizedCommitment {
  id: string;
  title: string;
  priority: "critical" | "high" | "medium" | "low";
  reasoning: string;
}

interface DailyFocus {
  day: string;
  focus: string;
  commitments: string[];
}

interface WeeklyPlan {
  weekSummary: string;
  prioritizedCommitments: PrioritizedCommitment[];
  recommendedDailyFocus: DailyFocus[];
  warningFlags: string[];
  lifeDomainAdvice: string;
  resurfacedGoals: string[];
  weeklyIntention: string;
  aiMeta?: {
    confidence: number;
    confidenceLabel: string;
    reasoning?: string;
  };
}

function getMondayISO(): string {
  const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export default function WeeklyPlanningPage() {
  const { user } = useUserStore();
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const mondayStr = getMondayISO();
    const planRef = doc(db, "users", user.uid, "weeklyPlans", mondayStr);

    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWeeklyPlan(data.plan || null);
        setGeneratedAt(data.generatedAt?.toDate() || new Date(data.generatedAt));
      } else {
        setWeeklyPlan(null);
        setGeneratedAt(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleGenerate = async () => {
    if (!user?.uid) return;
    setLoading(true);
    setApiError(null);

    try {
      const res = await fetch("/api/ai/weekly-planning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to generate weekly plan");
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Something went wrong while generating the weekly plan.");
    } finally {
      setLoading(false);
    }
  };

  const isRegenDisabled = () => {
    if (!generatedAt) return false;
    const ageMs = Date.now() - generatedAt.getTime();
    return ageMs < 24 * 60 * 60 * 1000; // Disabled if less than 24 hours old
  };

  const timeRemainingForRegen = () => {
    if (!generatedAt) return "";
    const nextAllowed = new Date(generatedAt.getTime() + 24 * 60 * 60 * 1000);
    return formatDistanceToNow(nextAllowed, { addSuffix: false });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "text-red-400 bg-red-400/10 border-red-500/20";
      case "high": return "text-amber-400 bg-amber-400/10 border-amber-500/20";
      case "medium": return "text-blue-400 bg-blue-400/10 border-blue-500/20";
      default: return "text-gray-400 bg-gray-400/10 border-gray-500/20";
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Weekly Focus Planning</h1>
          <p className="text-sm text-[#8B949E] mt-1">
            AI-driven prioritization, day-by-day focus roadmaps, and balance guides.
          </p>
        </div>

        {weeklyPlan && (
          <div className="flex items-center gap-3">
            {generatedAt && (
              <span className="text-xs text-[#8B949E]">
                Generated {formatDistanceToNow(generatedAt, { addSuffix: true })}
              </span>
            )}
            {isRegenDisabled() ? (
              <div className="relative group">
                <button
                  disabled
                  className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-[#21262D] text-[#8B949E] font-semibold border border-[#30363D] text-sm cursor-not-allowed transition"
                >
                  <Lock className="w-4 h-4 text-[#8B949E]" />
                  <span>Regenerate Plan</span>
                </button>
                <div className="hidden group-hover:block absolute bottom-full mb-2 right-0 bg-[#30363D] text-xs text-white p-2 rounded-lg z-10 w-56 text-center shadow-lg leading-relaxed border border-[#444C56]">
                  Available in {timeRemainingForRegen()} (limited to once every 24h to conserve resources).
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition duration-200 text-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>Regenerate Plan</span>
              </button>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm flex items-center gap-2 font-semibold">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{apiError}</span>
        </div>
      )}

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6"
          >
            {/* Shimmer loading skeleton */}
            <div className="h-28 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-96 md:col-span-2 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
              <div className="h-96 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
            </div>
          </motion.div>
        ) : !weeklyPlan ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#161B22] border border-[#30363D] rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-5 max-w-2xl mx-auto shadow-lg"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <Sparkles className="w-8 h-8 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-white font-extrabold text-xl">Generate your Weekly Focus Plan</h3>
              <p className="text-[#8B949E] text-sm max-w-md mx-auto leading-relaxed">
                FinishLine will review your streak, stress levels, goals, history, and active commitments to design an optimal execution roadmap.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition duration-200 text-base cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>Generate Plan</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Left Col (2/3 width) - Focus & prioritized commitments */}
            <div className="lg:col-span-2 space-y-6">
              {/* Weekly Intention & Summary Card */}
              <div className="bg-gradient-to-br from-[#1F2937] to-[#111827] border border-[#30363D] rounded-3xl p-6 shadow-md relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-xs uppercase font-extrabold tracking-wider">Weekly Intention</span>
                  </div>
                  <h2 className="text-2xl font-black text-white italic">
                    &ldquo;{weeklyPlan.weeklyIntention}&rdquo;
                  </h2>
                  <p className="text-[#8B949E] text-sm leading-relaxed border-t border-[#30363D] pt-4">
                    {weeklyPlan.weekSummary}
                  </p>
                </div>
              </div>

              {/* Day-by-Day Focus Grid */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-wider px-1">
                  Daily Execution Roadmap
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {weeklyPlan.recommendedDailyFocus.map((focusItem, idx) => (
                    <div 
                      key={focusItem.day}
                      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-4 space-y-3 flex flex-col justify-between hover:border-blue-500/20 transition group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between border-b border-[#30363D] pb-1.5">
                          <span className="text-xs font-bold text-white uppercase group-hover:text-blue-400 transition">
                            {focusItem.day}
                          </span>
                          <span className="text-[10px] text-[#8B949E] font-medium">Day {idx + 1}</span>
                        </div>
                        <p className="text-xs text-[#8B949E] leading-relaxed line-clamp-4">
                          {focusItem.focus}
                        </p>
                      </div>
                      
                      {focusItem.commitments && focusItem.commitments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {focusItem.commitments.map((cName) => (
                            <span 
                              key={cName}
                              className="text-[9px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full truncate max-w-full"
                              title={cName}
                            >
                              {cName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Prioritized Commitments Stack */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-wider px-1">
                  Prioritized Focus Stack
                </h3>
                <div className="space-y-3">
                  {weeklyPlan.prioritizedCommitments.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#8b949e]/30 transition"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full bg-[#21262D] border border-[#30363D] flex items-center justify-center text-xs font-black text-white shrink-0">
                          {idx + 1}
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-bold text-white">{item.title}</h4>
                          <p className="text-xs text-[#8B949E] leading-relaxed">{item.reasoning}</p>
                        </div>
                      </div>
                      <span className={`text-[10px] uppercase font-black tracking-wider px-3 py-1 rounded-full border shrink-0 text-center ${getPriorityColor(item.priority)}`}>
                        {item.priority}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col (1/3 width) - Warning flags, advice, goals */}
            <div className="space-y-6">
              {/* Warning Flags */}
              {weeklyPlan.warningFlags && weeklyPlan.warningFlags.length > 0 && (
                <div className="bg-[#1C1515] border border-red-500/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-red-400">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Warning Flags</h4>
                  </div>
                  <ul className="space-y-2.5 text-xs text-[#E8A5A5] leading-relaxed list-disc list-inside">
                    {weeklyPlan.warningFlags.map((flag, idx) => (
                      <li key={idx} className="marker:text-red-500">{flag}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Life Balance Advice */}
              <div className="bg-[#101917] border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400">
                  <Compass className="w-5 h-5 shrink-0" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">Life Balance Advice</h4>
                </div>
                <p className="text-xs text-[#A8D3C8] leading-relaxed">
                  {weeklyPlan.lifeDomainAdvice}
                </p>
              </div>

              {/* Long Term Goals */}
              {weeklyPlan.resurfacedGoals && weeklyPlan.resurfacedGoals.length > 0 && (
                <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 text-blue-400">
                    <TrendingUp className="w-5 h-5 shrink-0" />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Resurfaced Goals</h4>
                  </div>
                  <div className="space-y-3">
                    {weeklyPlan.resurfacedGoals.map((goal, idx) => (
                      <div key={idx} className="flex gap-2.5 items-start">
                        <CheckCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-white leading-relaxed">{goal}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Metadata Badge */}
              {weeklyPlan.aiMeta && (
                <div className="bg-[#0D1117] border border-[#21262D] rounded-2xl p-4 space-y-1.5 text-[11px] text-[#8B949E]">
                  <div className="flex items-center justify-between">
                    <span>AI Confidence</span>
                    <span className="font-semibold text-white">
                      {(weeklyPlan.aiMeta.confidence * 100).toFixed(0)}% ({weeklyPlan.aiMeta.confidenceLabel})
                    </span>
                  </div>
                  {weeklyPlan.aiMeta.reasoning && (
                    <p className="text-[10px] leading-relaxed italic border-t border-[#21262D] pt-1.5 mt-1.5">
                      {weeklyPlan.aiMeta.reasoning}
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
