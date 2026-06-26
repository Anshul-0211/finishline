"use client";

import { motion } from "framer-motion";

interface ProbabilitySimulatorProps {
  currentPath: number;
  recommendedPath: number;
}

export default function ProbabilitySimulator({ currentPath, recommendedPath }: ProbabilitySimulatorProps) {
  // Helpers to determine path colors
  const getPathColor = (val: number) => {
    if (val < 40) return "bg-red-500";
    if (val < 70) return "bg-amber-500";
    return "bg-green-500";
  };

  const getPathTextColor = (val: number) => {
    if (val < 40) return "text-red-400";
    if (val < 70) return "text-amber-400";
    return "text-green-400";
  };

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-2xl p-5 space-y-5 shadow-sm text-white">
      <div className="border-b border-[#30363D] pb-3">
        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
          Probability of Completion
        </h4>
        <p className="text-xs text-[#8B949E] mt-0.5">
          AI predictions comparing your current velocity vs the recommended schedule.
        </p>
      </div>

      <div className="space-y-4">
        {/* Current Path */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#8B949E] flex items-center gap-1.5">
              Current Path
              <span
                className="w-1.5 h-1.5 rounded-full bg-red-400"
                title="Current progression rate"
              />
            </span>
            <span className={getPathTextColor(currentPath)}>{currentPath}% Chance</span>
          </div>
          <div className="w-full h-3 bg-[#21262D] rounded-full overflow-hidden relative group">
            <motion.div
              className={`h-full ${getPathColor(currentPath)}`}
              initial={{ width: 0 }}
              animate={{ width: `${currentPath}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            {/* Tooltip description */}
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-0 bg-[#30363D] text-[10px] text-white p-2 rounded-lg z-10 w-64 shadow-md leading-relaxed">
              Current path: completing at this pace, you have a {currentPath}% chance of finishing on time.
            </div>
          </div>
        </div>

        {/* Recommended Path */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-[#8B949E] flex items-center gap-1.5">
              Recommended Path
              <span
                className="w-1.5 h-1.5 rounded-full bg-green-400"
                title="AI Scheduled blocks rate"
              />
            </span>
            <span className="text-green-400">{recommendedPath}% Chance</span>
          </div>
          <div className="w-full h-3 bg-[#21262D] rounded-full overflow-hidden relative group">
            <motion.div
              className="h-full bg-green-500"
              initial={{ width: 0 }}
              animate={{ width: `${recommendedPath}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            <div className="hidden group-hover:block absolute bottom-full mb-1 left-0 bg-[#30363D] text-[10px] text-white p-2 rounded-lg z-10 w-64 shadow-md leading-relaxed">
              Recommended path: following the suggested schedule, your odds improve to {recommendedPath}%.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
