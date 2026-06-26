"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot } from "firebase/firestore";
import { motion } from "framer-motion";
import { startOfWeek, format } from "date-fns";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  PolarRadiusAxis, 
  ResponsiveContainer 
} from "recharts";
import { Compass } from "lucide-react";

interface Commitment {
  id: string;
  title: string;
  domain: "academic" | "work" | "personal" | "health" | "social" | "family";
  estimatedEffort?: number;
  effortEstimateHours?: number;
  priority: number;
}

interface LifeBalanceRadarProps {
  userId: string;
  commitments: Commitment[];
}

const DOMAINS = ["academic", "work", "personal", "health", "social", "family"] as const;
type DomainType = typeof DOMAINS[number];

function getMondayISO(): string {
  const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export default function LifeBalanceRadar({ userId, commitments }: LifeBalanceRadarProps) {
  const [balanceAdvice, setBalanceAdvice] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    const mondayStr = getMondayISO();
    const planRef = doc(db, "users", userId, "weeklyPlans", mondayStr);

    const unsubscribe = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalanceAdvice(data?.plan?.lifeDomainAdvice || null);
      } else {
        setBalanceAdvice(null);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Calculate domain scores (effort * priority)
  const domainSums: Record<DomainType, number> = {
    academic: 0,
    work: 0,
    personal: 0,
    health: 0,
    social: 0,
    family: 0,
  };

  commitments.forEach((c) => {
    const dom = c.domain as DomainType;
    if (DOMAINS.includes(dom)) {
      const effort = c.estimatedEffort ?? c.effortEstimateHours ?? 0;
      const priority = c.priority || 1;
      domainSums[dom] += effort * priority;
    }
  });

  const maxSum = Math.max(...Object.values(domainSums));

  // Prepare data for Radar Chart
  const chartData = DOMAINS.map((domain) => {
    const val = maxSum > 0 ? (domainSums[domain] / maxSum) * 100 : 0;
    return {
      subject: domain.charAt(0).toUpperCase() + domain.slice(1),
      value: Math.round(val),
      raw: domainSums[domain],
    };
  });

  // Calculate unbalanced domains (normalized value > 60)
  const unbalanced = Object.entries(domainSums)
    .filter(([_, val]) => {
      const norm = maxSum > 0 ? (val / maxSum) * 100 : 0;
      return norm > 60;
    })
    .map(([dom]) => dom.charAt(0).toUpperCase() + dom.slice(1));

  let displayAdvice = "";
  if (balanceAdvice) {
    displayAdvice = balanceAdvice;
  } else if (unbalanced.length > 0) {
    displayAdvice = `Your schedule is currently skewed toward ${unbalanced.join(" & ")}. Consider dedicating time to other aspects of your life (e.g. personal growth, health, or family) to restore balance.`;
  } else {
    displayAdvice = "Your schedule has a healthy balance across all life domains. Keep up this sustainable rhythm!";
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-4 shadow-sm text-white flex flex-col justify-between"
    >
      <div className="border-b border-[#30363D] pb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider">Life Balance Radar</h3>
        <p className="text-xs text-[#8B949E] mt-0.5">
          Proportional time & energy allocation across domains.
        </p>
      </div>

      {maxSum === 0 ? (
        <div className="h-56 flex items-center justify-center text-xs text-[#8B949E] italic">
          No commitments to display radar data.
        </div>
      ) : (
        <div className="h-56 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke="#30363D" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fill: "#8B949E", fontSize: 10, fontWeight: "bold" }}
              />
              <PolarRadiusAxis 
                angle={30} 
                domain={[0, 100]} 
                tick={{ fill: "#8B949E", fontSize: 8 }}
                axisLine={false}
              />
              <Radar
                name="Balance"
                dataKey="value"
                stroke="#58a6ff"
                fill="#58a6ff"
                fillOpacity={0.2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Domain Balance Advice Box */}
      <div className="bg-[#101917] border border-emerald-500/20 rounded-xl p-4 flex gap-3 items-start">
        <Compass className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Balance Guide</h4>
          <p className="text-[11px] text-[#A8D3C8] leading-relaxed">
            {displayAdvice}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
