"use client";

import React, { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface LifeBalanceRadarProps {
  commitments: Array<{ domain: string; id: string }>;
  stressScore: number;
}

const DOMAINS = ["academic", "work", "personal", "health", "social", "family"] as const;

const DOMAIN_LABELS: Record<string, string> = {
  academic: "Academic",
  work: "Work",
  personal: "Personal",
  health: "Health",
  social: "Social",
  family: "Family",
};

const getRadarColor = (score: number, isDark: boolean) => {
  if (isDark) {
    return score < 40 ? "#4DDACF" : score <= 70 ? "#FFB870" : "#FFB4AB";
  }
  return score < 40 ? "#006761" : score <= 70 ? "#8F4D00" : "#BA1A1A";
};

export const LifeBalanceRadar: React.FC<LifeBalanceRadarProps> = ({
  commitments,
  stressScore,
}) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (commitments.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-card flex flex-col items-center justify-center min-h-[360px] border border-outline-variant">
        <header className="flex justify-between items-center w-full border-b border-outline-variant pb-3 mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-[16px] font-semibold text-on-surface font-sans">
              Life Balance
            </h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold font-label bg-surface-container text-on-surface-variant uppercase tracking-wider">
              live
            </span>
          </div>
        </header>
        <p className="text-outline text-center font-sans text-[16px]">
          Add commitments to see your life balance
        </p>
      </div>
    );
  }

  // Count commitments per domain
  const counts: Record<string, number> = {
    academic: 0,
    work: 0,
    personal: 0,
    health: 0,
    social: 0,
    family: 0,
  };

  commitments.forEach((c) => {
    const domainKey = c.domain?.toLowerCase();
    if (domainKey && domainKey in counts) {
      counts[domainKey]++;
    }
  });

  const chartData = DOMAINS.map((domain) => ({
    subject: DOMAIN_LABELS[domain],
    value: counts[domain],
  }));

  const domainCounts = DOMAINS.map((domain) => ({
    name: DOMAIN_LABELS[domain],
    count: counts[domain],
  }));

  // Derive most and least loaded
  const sorted = [...domainCounts].sort((a, b) => b.count - a.count);
  const mostLoaded = sorted[0];
  const leastLoaded = sorted[sorted.length - 1];

  const isDark = mounted && resolvedTheme === "dark";
  const radarColor = getRadarColor(stressScore, isDark);

  const gridStroke = isDark ? "#232630" : "#ECEEF1";
  const tickFill = isDark ? "#C4C6D0" : "#424654";
  const tooltipBg = isDark ? "#1E2128" : "#FFFFFF";
  const tooltipTextColor = isDark ? "#E2E3E8" : "#191C1E";

  return (
    <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-card border border-outline-variant flex flex-col justify-between">
      <header className="flex justify-between items-center w-full border-b border-outline-variant pb-3 mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-[16px] font-semibold text-on-surface font-sans">
            Life Balance
          </h3>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-semibold font-label bg-surface-container text-on-surface-variant uppercase tracking-wider">
            live
          </span>
        </div>
      </header>

      {/* Radar Chart Wrapper */}
      <div className="w-full flex justify-center items-center py-2 h-[320px] select-none">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
              <PolarGrid stroke={gridStroke} />
              <PolarAngleAxis dataKey="subject" tick={{ fill: tickFill, fontSize: 11, fontWeight: 600, fontFamily: "var(--font-label)" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  borderColor: isDark ? "#44464F" : "#C3C6D6",
                  color: tooltipTextColor,
                  borderRadius: "12px",
                  fontFamily: "var(--font-sans)",
                  fontSize: "12px",
                  boxShadow: "var(--shadow-card)",
                }}
              />
              <Radar
                name="Commitments"
                dataKey="value"
                stroke={radarColor}
                fill={radarColor}
                fillOpacity={0.2}
                strokeWidth={2}
                isAnimationActive={true}
                animationDuration={800}
              />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full bg-surface-container/10 animate-pulse rounded-full" />
        )}
      </div>

      {/* Domain Loader Labels */}
      <div className="mt-4 pt-4 border-t border-outline-variant flex flex-col sm:flex-row justify-between gap-3 text-[12px] font-semibold font-label">
        <div className="flex items-center gap-1.5">
          <span className="text-outline uppercase tracking-wider">Most loaded:</span>
          <span className="text-on-surface font-bold">
            {mostLoaded.name} ({mostLoaded.count})
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-outline uppercase tracking-wider">Least loaded:</span>
          <span className="text-on-surface font-bold">
            {leastLoaded.name} ({leastLoaded.count})
          </span>
        </div>
      </div>
    </div>
  );
};

export default LifeBalanceRadar;
