"use client";

import { motion } from "framer-motion";

interface StressGaugeProps {
  value: number; // 0 to 100
}

export default function StressGaugeCard({ value }: StressGaugeProps) {
  const normalizedValue = Math.max(0, Math.min(100, value));

  // Determine stress label and color
  let stressLabel = "Low stress";
  let gaugeColor = "#3FB950"; // Green
  let textColor = "text-green-500";

  if (normalizedValue > 70) {
    stressLabel = "High stress";
    gaugeColor = "#E53E3E"; // Red
    textColor = "text-red-500";
  } else if (normalizedValue > 40) {
    stressLabel = "Moderate stress";
    gaugeColor = "#F0B429"; // Amber
    textColor = "text-amber-500";
  }

  // SVG configuration
  const radius = 80;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  // Arc is 3/4 of a circle (270 degrees)
  const angleRange = 270;
  const arcLength = (circumference * angleRange) / 360;
  
  // Calculate stroke dashoffset for value representation
  const strokeDashoffset = arcLength - (normalizedValue / 100) * arcLength;

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-sm h-full min-h-[260px]">
      <h3 className="text-sm font-semibold text-[#8B949E] uppercase tracking-wider mb-4">
        Real-time Stress Level
      </h3>
      
      <div className="relative w-48 h-48 flex items-center justify-center">
        {/* SVG Arc Gauge */}
        <svg className="w-full h-full transform -rotate-225" viewBox="0 0 200 200">
          {/* Background circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke="#21262D"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Animated Foreground arc */}
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            fill="transparent"
            stroke={gaugeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            initial={{ strokeDashoffset: arcLength }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>

        {/* Text Inside Gauge */}
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold tracking-tight text-white">
            {normalizedValue}
          </span>
          <span className={`text-xs font-semibold mt-1 uppercase tracking-wider ${textColor}`}>
            {stressLabel}
          </span>
        </div>
      </div>
    </div>
  );
}
