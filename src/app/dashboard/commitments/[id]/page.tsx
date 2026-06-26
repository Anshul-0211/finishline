"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot, collection } from "firebase/firestore";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  AlertTriangle,
  CheckSquare,
  Shield,
  MessageSquare,
  Plus,
  Clock,
} from "lucide-react";
import ProbabilitySimulator from "@/components/commitments/ProbabilitySimulator";
import { motion, AnimatePresence } from "framer-motion";

function formatCountdown(deadlineVal: any): string {
  if (!deadlineVal) return "No deadline";
  const target = new Date(
    typeof deadlineVal.toDate === "function" ? deadlineVal.toDate() : deadlineVal
  ).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return "Overdue";

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));

  if (days > 0) {
    return `${days}d ${hours}h ${mins}m left`;
  }
  return `${hours}h ${mins}m left`;
}

export default function CommitmentDetailPage() {
  const { id } = useParams() as { id: string };
  const { user } = useUserStore();
  const router = useRouter();

  const [commitment, setCommitment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState("");

  // Modal Risk Explanation State
  const [explanationModalOpen, setExplanationModalOpen] = useState(false);
  const [explanationData, setExplanationData] = useState<any | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);

  // Action plan state
  const [generatingActionPlan, setGeneratingActionPlan] = useState(false);

  useEffect(() => {
    if (!user?.uid || !id) return;

    // Subscribe to commitment doc
    const docRef = doc(db, "users", user.uid, "commitments", id);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCommitment({ id: docSnap.id, ...data });

        // Auto-generate action plan if missing
        if (!data.actionPlan && !generatingActionPlan) {
          triggerActionPlanGeneration(user.uid, docSnap.id);
        }
      } else {
        setCommitment(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, id]);

  // Live countdown ticker
  useEffect(() => {
    if (!commitment?.deadline) return;

    setCountdown(formatCountdown(commitment.deadline));
    const interval = setInterval(() => {
      setCountdown(formatCountdown(commitment.deadline));
    }, 60000); // update every minute

    return () => clearInterval(interval);
  }, [commitment?.deadline]);

  const triggerActionPlanGeneration = async (userId: string, commitmentId: string) => {
    setGeneratingActionPlan(true);
    try {
      await fetch("/api/ai/generate-action-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, commitmentId }),
      });
    } catch (err) {
      console.error("Failed to auto-generate action plan:", err);
    } finally {
      setGeneratingActionPlan(false);
    }
  };

  const handleStepToggle = async (stepIndex: number, completed: boolean) => {
    if (!user?.uid || !id) return;
    try {
      await fetch(`/api/commitments/${id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIndex, completed }),
      });
    } catch (err) {
      console.error("Failed to update step progress:", err);
    }
  };

  const handleExplainRisk = async () => {
    if (!user?.uid || !id) return;
    setExplanationModalOpen(true);
    setLoadingExplanation(true);
    try {
      const res = await fetch("/api/ai/explain-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commitmentId: id, userId: user.uid }),
      });
      if (res.ok) {
        const data = await res.json();
        setExplanationData(data);
      }
    } catch (err) {
      console.error("Failed to fetch risk explanation:", err);
    } finally {
      setLoadingExplanation(false);
    }
  };

  const handleInitiateRenegotiation = async () => {
    if (!user?.uid || !id) return;
    try {
      // Generate a dynamic renegotiation document reference ID
      const renegCollectionRef = collection(db, "users", user.uid, "renegotiations");
      const tempRef = doc(renegCollectionRef);
      const renegId = tempRef.id;

      // Start the conversation turn
      const res = await fetch("/api/ai/renegotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renegotiationId: renegId,
          message: "I need to reschedule this commitment due to conflicts.",
          userId: user.uid,
          commitmentId: id,
        }),
      });

      if (res.ok) {
        router.push(`/dashboard/renegotiate/${renegId}`);
      }
    } catch (err) {
      console.error("Failed to initiate renegotiation:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#8B949E]">Loading commitment details...</span>
      </div>
    );
  }

  if (!commitment) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4 text-white">
        <h4 className="font-bold text-lg">Commitment not found</h4>
        <Link href="/dashboard" className="text-blue-400 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  // Determine risk level styling
  let riskBg = "bg-green-500/10 text-green-400 border-green-500/20";
  if (commitment.riskScore > 70) {
    riskBg = "bg-red-500/10 text-red-400 border-red-500/20";
  } else if (commitment.riskScore > 40) {
    riskBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
  }

  const trendIcon = commitment.riskTrend === "up" ? "↑" : commitment.riskTrend === "down" ? "↓" : "→";
  const trendColor =
    commitment.riskTrend === "up"
      ? "text-red-500 font-bold"
      : commitment.riskTrend === "down"
      ? "text-green-500 font-bold"
      : "text-gray-500";

  return (
    <div className="space-y-8 pb-12 text-white">
      {/* Header section */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#30363D] pb-6">
        <div className="space-y-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-[#8B949E] hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{commitment.title}</h1>
            <span className="text-xs uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full border bg-blue-500/10 text-blue-400 border-blue-500/20">
              {commitment.domain}
            </span>
          </div>
          <p className="text-sm text-[#8B949E]">{commitment.description}</p>
        </div>

        {/* Date and actions */}
        <div className="flex flex-col sm:items-end space-y-2 shrink-0">
          <span className="text-xs text-[#8B949E] font-medium uppercase tracking-wider">
            Deadline countdown
          </span>
          <span className="text-lg font-bold text-white bg-[#161B22] border border-[#30363D] px-4 py-2 rounded-xl">
            {countdown}
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Risk stats & Probability chart */}
        <div className="lg:col-span-1 space-y-6">
          {/* Risk Card */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-[#8B949E] uppercase tracking-wider">
              Risk Assessment
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-extrabold tracking-tight">{commitment.riskScore}%</span>
                <span className={`text-sm ${trendColor}`}>
                  {trendIcon} {commitment.riskTrend}
                </span>
              </div>
              <button
                onClick={handleExplainRisk}
                className="py-2 px-4 rounded-xl bg-[#21262D] border border-[#30363D] hover:border-[#8b949e]/40 hover:text-white transition font-semibold text-xs text-[#8B949E] cursor-pointer"
              >
                Why?
              </button>
            </div>
            {/* Risk bar visual */}
            <div className={`border p-3.5 rounded-xl text-xs leading-relaxed ${riskBg}`}>
              {commitment.riskScore > 70
                ? "Critical Overload: This commitment is severely behind. Please consider re-scheduling to avoid missed deadlines."
                : commitment.riskScore > 40
                ? "Moderate Risk: Track progression actively. Gaps in your scheduled calendar blocks exist."
                : "Safe Target: Progression and schedule are aligned. Risk is fully managed."}
            </div>
          </div>

          {/* Probability Simulator */}
          <ProbabilitySimulator
            currentPath={commitment.probabilityCurrentPath || 100}
            recommendedPath={commitment.probabilityRecommendedPath || 100}
          />

          {/* Action Button renegotiate */}
          <button
            onClick={handleInitiateRenegotiation}
            className={`w-full py-3.5 rounded-xl font-bold shadow-md transition duration-200 cursor-pointer flex items-center justify-center gap-2 text-sm ${
              commitment.riskScore > 60
                ? "bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-500 hover:to-red-500 text-white"
                : "bg-[#21262D] border border-[#30363D] hover:border-[#8b949e]/40 text-white"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Renegotiate Deadline</span>
          </button>
        </div>

        {/* Right Side: Action Plan & Calendar blocks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Plan */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Action Plan</h3>

            {generatingActionPlan || !commitment.actionPlan ? (
              <div className="space-y-3 py-4">
                <div className="h-5 w-2/3 bg-[#21262D] rounded animate-pulse" />
                <div className="h-5 w-1/2 bg-[#21262D] rounded animate-pulse" />
                <div className="h-5 w-3/4 bg-[#21262D] rounded animate-pulse" />
              </div>
            ) : (
              <div className="divide-y divide-[#30363D]/50">
                {commitment.actionPlan.steps.map((step: any, index: number) => (
                  <div
                    key={step.id || index}
                    className="flex items-start gap-3.5 py-3.5 first:pt-0 last:pb-0"
                  >
                    <input
                      type="checkbox"
                      checked={step.completed}
                      onChange={(e) => handleStepToggle(index, e.target.checked)}
                      className="w-4.5 h-4.5 rounded border-[#30363D] bg-[#0D1117] text-blue-600 focus:ring-blue-500 focus:ring-offset-[#161B22] focus:outline-none transition cursor-pointer mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0 text-sm">
                      <span
                        className={`font-semibold ${
                          step.completed ? "line-through text-[#8B949E]" : "text-white"
                        }`}
                      >
                        {step.title}
                      </span>
                      {step.notes && <p className="text-xs text-[#8B949E] mt-0.5">{step.notes}</p>}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="inline-flex items-center gap-1 text-[10px] bg-[#21262D] text-[#8B949E] px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3 text-[#8B949E]" />
                          <span>{step.estimatedMinutes} mins</span>
                        </span>
                        {step.cognitiveIntensity && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                              step.cognitiveIntensity === "high"
                                ? "bg-red-500/10 text-red-400 border-red-500/20"
                                : step.cognitiveIntensity === "medium"
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                : "bg-green-500/10 text-green-400 border-green-500/20"
                            }`}
                          >
                            {step.cognitiveIntensity} load
                          </span>
                        )}
                        {step.suggestedTimeSlot && (
                          <span className="text-[10px] text-blue-400 bg-blue-500/5 border border-blue-500/10 px-2 py-0.5 rounded-full font-medium">
                            {new Date(step.suggestedTimeSlot).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Scheduled Calendar Blocks */}
          <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#30363D] pb-3">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Scheduled Work Blocks
              </h3>
              <span className="text-xs text-[#8B949E] font-medium">
                {commitment.calendarBlocks?.length || 0} slots booked
              </span>
            </div>

            {(!commitment.calendarBlocks || commitment.calendarBlocks.length === 0) ? (
              <p className="text-xs text-[#8B949E] py-2">
                No calendar blocks are currently booked for this commitment.
              </p>
            ) : (
              <div className="space-y-3">
                {commitment.calendarBlocks.map((block: any, idx: number) => {
                  const startStr = new Date(block.start).toLocaleDateString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const timeRangeStr = `${new Date(block.start).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })} - ${new Date(block.end).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`;

                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3.5 bg-[#0D1117] border border-[#30363D] rounded-xl hover:border-[#8b949e]/40 transition group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 shrink-0">
                          <Calendar className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-sm font-bold text-white group-hover:text-blue-400 transition">
                            {block.title || commitment.title}
                          </h5>
                          <p className="text-xs text-[#8B949E] mt-0.5">
                            {startStr} • {timeRangeStr}
                          </p>
                        </div>
                      </div>
                      {block.calendarEventId ? (
                        <a
                          href="https://calendar.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:underline shrink-0 font-medium"
                        >
                          View Calendar →
                        </a>
                      ) : (
                        <span className="text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold shrink-0">
                          Sync Pending
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Risk Explanation Modal */}
      <AnimatePresence>
        {explanationModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[#161B22] border border-[#30363D] rounded-2xl max-w-md w-full overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-[#30363D] flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-400">
                  <Shield className="w-5 h-5" />
                  <h4 className="font-extrabold text-base">Risk Factor Explanation</h4>
                </div>
                <button
                  onClick={() => setExplanationModalOpen(false)}
                  className="text-[#8B949E] hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4">
                {loadingExplanation ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    <span className="text-xs text-[#8B949E]">AI is analyzing risk parameters...</span>
                  </div>
                ) : explanationData ? (
                  <div className="space-y-4 text-sm">
                    {/* The core explanation narrative */}
                    <p className="text-white leading-relaxed">{explanationData.explanation}</p>

                    {/* Primary risk driver */}
                    <div className="bg-[#0D1117] p-3.5 rounded-xl border border-[#30363D]">
                      <span className="text-[10px] text-[#8B949E] uppercase tracking-wider font-bold">
                        Primary Driver
                      </span>
                      <p className="text-white font-bold mt-1 text-sm">
                        {explanationData.primaryFactor}
                      </p>
                    </div>

                    {/* Actionable suggested mitigation */}
                    <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-xl">
                      <span className="text-[10px] uppercase tracking-wider font-bold block mb-1">
                        Suggested Mitigation
                      </span>
                      <p className="text-sm font-medium">{explanationData.suggestedAction}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-[#8B949E] text-center">Failed to load explanation.</p>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-[#0D1117] border-t border-[#30363D] flex justify-end">
                <button
                  onClick={() => setExplanationModalOpen(false)}
                  className="py-2 px-5 rounded-xl bg-[#21262D] border border-[#30363D] text-white hover:bg-[#30363D] transition text-sm font-semibold cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add simple Loader2 icon fallback
function Loader2({ className }: { className?: string }) {
  return <div className={`border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />;
}
