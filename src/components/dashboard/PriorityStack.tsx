"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertCircle, Calendar, Plus, CheckSquare } from "lucide-react";
import { useEffect, useState } from "react";

interface Commitment {
  id: string;
  title: string;
  domain: "academic" | "work" | "personal" | "health" | "social" | "family";
  deadline: any;
  riskScore: number;
  calendarSyncStatus: "synced" | "pending";
  completionPercentage: number;
}

interface PriorityStackProps {
  commitments: Commitment[];
}

const DOMAIN_COLORS: Record<string, string> = {
  academic: "bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/20",
  work: "bg-[#9B59B6]/10 text-[#9B59B6] border-[#9B59B6]/20",
  personal: "bg-[#E67E22]/10 text-[#E67E22] border-[#E67E22]/20",
  health: "bg-[#27AE60]/10 text-[#27AE60] border-[#27AE60]/20",
  social: "bg-[#E91E63]/10 text-[#E91E63] border-[#E91E63]/20",
  family: "bg-[#795548]/10 text-[#795548] border-[#795548]/20",
};

function formatCountdown(deadlineVal: any): { text: string; isOverdue: boolean } {
  if (!deadlineVal) return { text: "No deadline", isOverdue: false };
  const target = new Date(
    typeof deadlineVal.toDate === "function" ? deadlineVal.toDate() : deadlineVal
  ).getTime();
  const diff = target - Date.now();
  if (diff <= 0) return { text: "Overdue", isOverdue: true };

  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  if (days > 0) {
    return { text: `${days}d ${hours}h left`, isOverdue: false };
  }
  return { text: `${hours}h left`, isOverdue: true }; // High urgency/close to deadline
}

export default function PriorityStack({ commitments }: PriorityStackProps) {
  // Sort commitments by riskScore desc
  const sorted = [...commitments].sort((a, b) => b.riskScore - a.riskScore);

  if (sorted.length === 0) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-12 text-center flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
          <CheckSquare className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-white font-bold text-lg">Your week is clear</h4>
          <p className="text-[#8B949E] text-sm mt-1">
            Add a commitment to let FinishLine start tracking.
          </p>
        </div>
        <Link
          href="/dashboard/add"
          className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition duration-200 text-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Commitment</span>
        </Link>
      </div>
    );
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-wider px-1">
        Priority Commitment Stack
      </h3>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-3"
      >
        {sorted.map((item) => {
          const { text: countdownText, isOverdue } = formatCountdown(item.deadline);

          // Determine risk level color
          let riskColor = "bg-green-500";
          let riskTextColor = "text-green-500";
          if (item.riskScore > 70) {
            riskColor = "bg-red-500";
            riskTextColor = "text-red-500";
          } else if (item.riskScore > 40) {
            riskColor = "bg-amber-500";
            riskTextColor = "text-amber-500";
          }

          return (
            <motion.div key={item.id} variants={cardVariants}>
              <Link
                href={`/dashboard/commitments/${item.id}`}
                className="block bg-[#161B22] border border-[#30363D] hover:border-[#8b949e]/40 rounded-2xl p-5 shadow-sm transition duration-200 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Left part: Title & badges */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-white group-hover:text-blue-400 transition truncate max-w-[250px] sm:max-w-md">
                        {item.title}
                      </h4>
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                          DOMAIN_COLORS[item.domain] || "bg-[#8B949E]/10 text-[#8B949E]"
                        }`}
                      >
                        {item.domain}
                      </span>
                      {item.calendarSyncStatus === "pending" && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold">
                          <Calendar className="w-3 h-3" />
                          <span>Calendar sync pending</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#8B949E] flex items-center gap-2">
                      <span className={isOverdue ? "text-red-500 font-semibold" : "font-medium"}>
                        {countdownText}
                      </span>
                      <span>•</span>
                      <span>{item.completionPercentage || 0}% completed</span>
                    </div>
                  </div>

                  {/* Right part: Risk score and bar */}
                  <div className="w-full sm:w-36 flex flex-col sm:items-end justify-center space-y-1.5 shrink-0">
                    <div className="flex items-center justify-between sm:justify-end w-full text-xs font-semibold">
                      <span className="text-[#8B949E] sm:hidden">Risk Score:</span>
                      <span className={riskTextColor}>{item.riskScore}% Risk</span>
                    </div>
                    {/* Risk progress bar */}
                    <div className="w-full h-2 bg-[#21262D] rounded-full overflow-hidden">
                      <motion.div
                        className={`h-full ${riskColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.riskScore}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
