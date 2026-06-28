"use client";

import React from "react";
import { useTheme } from "next-themes";

export interface StressArcProps {
  score: number;
  size?: number; // default 200
}

export function getStressArcColors(score: number, isDark: boolean) {
  if (isDark) {
    return {
      track: "#232630",
      fill:  score < 40 ? "#4DDACF" : score <= 70 ? "#FFB870" : "#FFB4AB",
      text:  score < 40 ? "#4DDACF" : score <= 70 ? "#FFB870" : "#FFB4AB",
      label: "#8E9099",
    };
  }
  return {
    track: "#ECEEF1",
    fill:  score < 40 ? "#006761" : score <= 70 ? "#8F4D00" : "#BA1A1A",
    text:  score < 40 ? "#006761" : score <= 70 ? "#8F4D00" : "#BA1A1A",
    label: "#737785",
  };
}

export const StressArc: React.FC<StressArcProps> = ({ score, size = 200 }) => {
  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  
  // Calculate SVG geometry
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  
  // 240 degree span of the gauge
  const totalArcLength = (240 / 360) * circumference;
  const progressLength = (normalizedScore / 100) * totalArcLength;
  
  // Define labels based on score ranges
  let description = "Low Load";
  if (normalizedScore > 40 && normalizedScore <= 70) {
    description = "Moderate";
  } else if (normalizedScore > 70) {
    description = "High Stress";
  }

  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const colors = getStressArcColors(normalizedScore, isDark);

  return (
    <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-[210deg]"
        >
          {/* Track Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.track}
            strokeWidth={strokeWidth}
            strokeDasharray={`${totalArcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={colors.fill}
            strokeWidth={strokeWidth}
            strokeDasharray={`${progressLength} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Centered Labels */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pt-4">
          <span 
            className="text-[32px] font-extrabold font-sans leading-none tracking-tight"
            style={{ color: colors.text }}
          >
            {normalizedScore}
          </span>
          <span 
            className="text-[12px] font-semibold font-label tracking-[0.05em] uppercase mt-1"
            style={{ color: colors.label }}
          >
            {description}
          </span>
        </div>
      </div>
    </div>
  );
};

export default StressArc;
