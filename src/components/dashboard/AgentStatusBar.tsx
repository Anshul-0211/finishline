"use client";

import { useEffect, useState } from "react";
import { Shield, RefreshCw } from "lucide-react";

interface AgentStatusData {
  lastRunAt: string | null;
  commitmentCount: number;
  risksUpdated: number;
  collisionsDetected: number;
  checkInsSent: number;
}

interface AgentStatusBarProps {
  userId: string;
}

export default function AgentStatusBar({ userId }: AgentStatusBarProps) {
  const [status, setStatus] = useState<AgentStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeAgoText, setTimeAgoText] = useState("Never ran");
  const [dotColor, setDotColor] = useState("bg-red-500");

  const fetchStatus = async () => {
    if (!userId) return;
    try {
      const res = await fetch(`/api/agent/status/${userId}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        updateTimeAndColor(data?.lastRunAt);
      }
    } catch (err) {
      console.error("Failed to fetch agent status:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateTimeAndColor = (lastRunAt: string | null) => {
    if (!lastRunAt) {
      setTimeAgoText("Never ran");
      setDotColor("bg-red-500");
      return;
    }

    const lastRunTime = new Date(lastRunAt).getTime();
    const diffMs = Date.now() - lastRunTime;
    const diffMins = Math.floor(diffMs / (60 * 1000));

    if (diffMins < 1) {
      setTimeAgoText("Just now");
    } else {
      setTimeAgoText(`${diffMins}m ago`);
    }

    if (diffMins < 35) {
      setDotColor("bg-green-500");
    } else if (diffMins < 65) {
      setDotColor("bg-amber-500");
    } else {
      setDotColor("bg-red-500");
    }
  };

  useEffect(() => {
    fetchStatus();
    
    // Poll status from API
    const apiInterval = setInterval(fetchStatus, 5 * 60 * 1000);

    // Refresh time-ago texts every 60 seconds
    const timeInterval = setInterval(() => {
      if (status?.lastRunAt) {
        updateTimeAndColor(status.lastRunAt);
      }
    }, 60 * 1000);

    return () => {
      clearInterval(apiInterval);
      clearInterval(timeInterval);
    };
  }, [userId, status?.lastRunAt]);

  if (loading) {
    return (
      <div className="bg-[#161B22] border border-[#30363D] rounded-xl px-5 py-3 flex items-center justify-between text-xs text-[#8B949E] animate-pulse">
        <span>Checking autonomous agent status...</span>
      </div>
    );
  }

  return (
    <div className="bg-[#161B22] border border-[#30363D] rounded-xl px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#8B949E] shadow-sm select-none">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="font-semibold text-white">Agent Heartbeat:</span>
        </div>
        <span>Last ran {timeAgoText}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Shield className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {status?.commitmentCount || 0} commitments tracked
          </span>
        </div>
        <span>|</span>
        <span>
          {status?.collisionsDetected || 0} collisions this run
        </span>
        <button
          onClick={() => {
            setLoading(true);
            fetchStatus();
          }}
          className="p-1 hover:bg-[#21262D] rounded text-[#8B949E] hover:text-white transition cursor-pointer"
          title="Refresh Heartbeat"
        >
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
