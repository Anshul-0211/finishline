"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { startOfWeek, format, formatDistanceToNow } from "date-fns";
import { 
  BookOpen, 
  Sparkles, 
  Lightbulb, 
  TrendingUp, 
  Smile, 
  AlertTriangle,
  Loader2,
  Lock,
  RefreshCw
} from "lucide-react";

interface WeeklyReflection {
  completionRate: number;
  narrative: string;
  patternsObserved: string[];
  topInsight: string;
  nextWeekRecommendation: string;
  motivationalMessage: string;
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

export default function WeeklyReflectionPage() {
  const { user } = useUserStore();
  const [reflection, setReflection] = useState<WeeklyReflection | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const mondayStr = getMondayISO();
    const reflectionRef = doc(db, "users", user.uid, "reflections", mondayStr);

    const unsubscribe = onSnapshot(reflectionRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setReflection(data.reflection || null);
        setGeneratedAt(data.generatedAt?.toDate() || new Date(data.generatedAt));
      } else {
        setReflection(null);
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
      const res = await fetch("/api/ai/weekly-reflection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to generate reflection");
      }
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Something went wrong while generating the weekly reflection.");
    } finally {
      setLoading(false);
    }
  };

  const isRegenDisabled = () => {
    if (!generatedAt) return false;
    const ageMs = Date.now() - generatedAt.getTime();
    return ageMs < 6 * 24 * 60 * 60 * 1000; // Disabled if less than 6 days old
  };

  const timeRemainingForRegen = () => {
    if (!generatedAt) return "";
    const nextAllowed = new Date(generatedAt.getTime() + 6 * 24 * 60 * 60 * 1000);
    return formatDistanceToNow(nextAllowed, { addSuffix: false });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Weekly Performance Reflection</h1>
          <p className="text-sm text-[#8B949E] mt-1">
            Analyze your completion rate, patterns of underestimation, and mental stress.
          </p>
        </div>

        {reflection && (
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
                  <span>New Reflection</span>
                </button>
                <div className="hidden group-hover:block absolute bottom-full mb-2 right-0 bg-[#30363D] text-xs text-white p-2 rounded-lg z-10 w-60 text-center shadow-lg leading-relaxed border border-[#444C56]">
                  Available in {timeRemainingForRegen()} (limited to once every 6 days).
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition duration-200 text-sm cursor-pointer disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                <span>New Reflection</span>
              </button>
            )}
          </div>
        )}
      </div>

      {apiError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-sm flex items-center gap-3 font-semibold">
          <AlertTriangle className="w-5 h-5 shrink-0" />
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
            <div className="h-44 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
            <div className="h-64 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
          </motion.div>
        ) : !reflection ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-[#161B22] border border-[#30363D] rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-5 max-w-2xl mx-auto shadow-lg"
          >
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <BookOpen className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-white font-extrabold text-xl">Reflect on your Weekly Achievements</h3>
              <p className="text-[#8B949E] text-sm max-w-md mx-auto leading-relaxed">
                Unlock personal insights. AI analyzes your completed tasks, scheduling slips, and learning metrics to help you work smarter.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 py-3 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition duration-200 text-base cursor-pointer"
            >
              <Sparkles className="w-5 h-5" />
              <span>Generate Reflection</span>
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Narrative Hero Card */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-3xl p-8 relative overflow-hidden shadow-sm">
              <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 pb-6 border-b border-[#30363D] mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center text-blue-400">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Your Weekly Story</h3>
                    <p className="text-xs text-[#8B949E]">AI narrative synthesis of your performance</p>
                  </div>
                </div>

                <div className="bg-[#21262D] border border-[#30363D] rounded-2xl px-5 py-3 text-center shrink-0">
                  <span className="text-[10px] uppercase font-black text-[#8B949E] tracking-wider block">
                    Completion Rate
                  </span>
                  <span className={`text-2xl font-black ${
                    reflection.completionRate > 75 ? "text-green-400" : reflection.completionRate > 40 ? "text-amber-400" : "text-red-400"
                  }`}>
                    {reflection.completionRate.toFixed(0)}%
                  </span>
                </div>
              </div>

              <p className="text-lg text-white leading-relaxed font-medium">
                {reflection.narrative}
              </p>
            </div>

            {/* Grid for Insight, Action, and Closing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column: Top Insight */}
              <div className="bg-gradient-to-br from-[#1F2937]/50 to-[#111827]/50 border border-[#30363D] rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 text-blue-400">
                  <Lightbulb className="w-5 h-5" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">Top Insight</h4>
                </div>
                <p className="text-sm text-white leading-relaxed font-semibold">
                  {reflection.topInsight}
                </p>
              </div>

              {/* Right Column: Next Week Recommendation */}
              <div className="bg-gradient-to-br from-[#101917] to-[#0A0F0E] border border-emerald-500/20 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center gap-2.5 text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                  <h4 className="text-sm font-bold uppercase tracking-wider">Next Week Action Plan</h4>
                </div>
                <p className="text-sm text-[#A8D3C8] leading-relaxed font-semibold">
                  {reflection.nextWeekRecommendation}
                </p>
              </div>
            </div>

            {/* Pattern Observed chips */}
            {reflection.patternsObserved && reflection.patternsObserved.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#8B949E] uppercase tracking-wider px-1">
                  Observed Behavioral Patterns
                </h4>
                <div className="flex flex-wrap gap-2.5">
                  {reflection.patternsObserved.map((pattern, idx) => (
                    <span 
                      key={idx}
                      className="bg-[#21262D] border border-[#30363D] text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm hover:border-[#8b949e]/30 transition"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Motivational message (honest closing assessment) */}
            <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 text-center space-y-2">
              <Smile className="w-6 h-6 text-blue-400 mx-auto" />
              <p className="text-xs text-[#8B949E] max-w-lg mx-auto italic leading-relaxed">
                &ldquo;{reflection.motivationalMessage}&rdquo;
              </p>
            </div>

            {/* AI Metadata */}
            {reflection.aiMeta && (
              <div className="bg-[#0D1117] border border-[#21262D] rounded-2xl p-4 space-y-1.5 text-[11px] text-[#8B949E] max-w-sm">
                <div className="flex items-center justify-between">
                  <span>AI Confidence</span>
                  <span className="font-semibold text-white">
                    {(reflection.aiMeta.confidence * 100).toFixed(0)}% ({reflection.aiMeta.confidenceLabel})
                  </span>
                </div>
                {reflection.aiMeta.reasoning && (
                  <p className="text-[10px] leading-relaxed italic border-t border-[#21262D] pt-1.5 mt-1.5">
                    {reflection.aiMeta.reasoning}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
