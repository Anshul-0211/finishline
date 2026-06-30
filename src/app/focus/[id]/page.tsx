"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Square, Check, Pencil } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { PillButton } from "@/components/ui/pill-button";
import { updateCommitment } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";

export default function FocusModePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, setUser, userProfile, subscribeToUserProfile } = useUserStore();
  const { commitments, loading: commitmentsLoading, subscribeToCommitments } = useCommitmentsStore();
  const { resolvedTheme } = useTheme();

  // State Management
  const [timerStatus, setTimerStatus] = useState<"idle" | "running" | "paused">("idle");
  const [isBreak, setIsBreak] = useState(false);
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [sessionIndex, setSessionIndex] = useState(1);
  const [progressPercentage, setProgressPercentage] = useState(0);
  const [showComplete, setShowComplete] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Telemetry Logging States
  const [startTime, setStartTime] = useState<string | null>(null);
  const [accumulatedSeconds, setAccumulatedSeconds] = useState(0);
  const [uninterruptedSeconds, setUninterruptedSeconds] = useState(0);

  // Telemetry Dispatcher
  const sendLogEvent = async (
    type: 'start' | 'pause' | 'resume' | 'stop' | 'complete', 
    termination: 'completed' | 'abandoned' | 'paused',
    overrideAccumulated?: number,
    overrideUninterrupted?: number
  ) => {
    if (!user || isBreak) return;
    try {
      const idToken = await user.getIdToken();
      const currentStart = startTime || new Date().toISOString();
      const now = new Date().toISOString();

      const finalAccumulated = typeof overrideAccumulated === 'number' ? overrideAccumulated : accumulatedSeconds;
      const finalUninterrupted = typeof overrideUninterrupted === 'number' ? overrideUninterrupted : uninterruptedSeconds;
      const uninterruptedMinutes = Number((finalUninterrupted / 60).toFixed(2));

      await fetch("/api/telemetry/log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          commitmentId: params.id,
          eventType: type,
          durationSeconds: finalAccumulated,
          uninterruptedFocusMinutes: uninterruptedMinutes,
          startTime: currentStart,
          endTime: now,
          terminationState: termination,
          timestamp: now
        })
      });
    } catch (err) {
      console.warn("[Telemetry] Failed to log event:", err);
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        router.push("/");
      } else {
        setUser(firebaseUser);
      }
    });
    return () => unsubscribeAuth();
  }, [router, setUser]);

  // Firestore Commitments Subscription
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToCommitments(user.uid);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, subscribeToCommitments]);

  // Firestore User Profile Subscription
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToUserProfile(user.uid);
    return () => {
      if (unsub) unsub();
    };
  }, [user?.uid, subscribeToUserProfile]);

  // Redirect if commitments are loaded and no matching commitment is found
  useEffect(() => {
    if (!user || commitmentsLoading) return;
    const commitment = commitments.find((c) => c.id === params.id);
    if (!commitment) {
      router.push("/dashboard");
    }
  }, [user, commitments, commitmentsLoading, params.id, router]);

  // Sync progressPercentage state with commitment data in Firestore
  useEffect(() => {
    const commitment = commitments.find((c) => c.id === params.id);
    if (commitment) {
      setProgressPercentage(commitment.completionPercentage ?? 0);
    }
  }, [commitments, params.id]);

  // Timer loop logic
  useEffect(() => {
    let interval: any = null;
    if (timerStatus === "running") {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
        setAccumulatedSeconds((prev) => prev + 1);
        setUninterruptedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerStatus]);

  const handleTimerComplete = () => {
    setTimerStatus("idle");
    setShowComplete(true);
    sendLogEvent("complete", "completed");
    setStartTime(null);
    setAccumulatedSeconds(0);
    setUninterruptedSeconds(0);
  };

  const handleStartPause = () => {
    if (timerStatus === "running") {
      setTimerStatus("paused");
      sendLogEvent("pause", "paused");
    } else {
      if (timerStatus === "idle") {
        const now = new Date().toISOString();
        setStartTime(now);
        setAccumulatedSeconds(0);
        setUninterruptedSeconds(0);
        setTimerStatus("running");
        sendLogEvent("start", "paused", 0, 0);
      } else if (timerStatus === "paused") {
        setUninterruptedSeconds(0);
        setTimerStatus("running");
        sendLogEvent("resume", "paused", accumulatedSeconds, 0);
      }
    }
  };

  const handleStop = () => {
    setTimerStatus("idle");
    setSecondsRemaining(isBreak ? breakMinutes * 60 : focusMinutes * 60);
    sendLogEvent("stop", "abandoned");
    setStartTime(null);
    setAccumulatedSeconds(0);
    setUninterruptedSeconds(0);
  };

  const handleLogProgress = async () => {
    if (!params.id) return;
    try {
      await updateCommitment(params.id, {
        lastProgressAt: serverTimestamp() as any,
        daysSinceLastProgress: 0,
        completionPercentage: progressPercentage,
      });
      setShowComplete(false);
      setIsBreak(false);
      setSecondsRemaining(focusMinutes * 60);
      setSessionIndex((prev) => (prev < 4 ? prev + 1 : 1));
    } catch (err) {
      console.error("Failed to log focus progress:", err);
    }
  };

  const handleStartBreak = () => {
    setShowComplete(false);
    setIsBreak(true);
    setSecondsRemaining(breakMinutes * 60);
    setTimerStatus("running");
  };

  const handleSaveSettings = () => {
    const newTotal = isBreak ? breakMinutes * 60 : focusMinutes * 60;
    setSecondsRemaining(newTotal);
    setTimerStatus("idle");
    setShowEditModal(false);
  };

  const handleCompleteTask = async () => {
    if (!params.id) return;
    try {
      const effortHours = (sessionIndex * 25) / 60;
      await updateCommitment(params.id, {
        status: "completed",
        completedAt: serverTimestamp() as any,
        actualEffortHours: effortHours,
        completionPercentage: 100,
      } as any);
      setTimerStatus("idle");
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to mark task as completed:", err);
    }
  };

  const fastForward = () => {
    setSecondsRemaining(5);
  };

  // Find Commitment details, fallback for layout reviews
  const commitment = commitments.find((c) => c.id === params.id);
  const commitmentTitle = commitment?.title || "OS Memory Allocator Assignment";

  const showSkeleton = !user || commitmentsLoading;

  if (showSkeleton) {
    return (
      <div className="min-h-screen bg-background relative flex flex-col items-center justify-between py-8 px-6 overflow-hidden font-sans">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/4 dark:bg-primary/8 rounded-full blur-[80px] pointer-events-none" />
        <header className="w-full max-w-[480px] flex items-center justify-between z-10 flex-shrink-0">
          <div className="h-5 w-12 bg-surface-container animate-pulse rounded" />
          <div className="h-5 w-32 bg-surface-container animate-pulse rounded" />
          <div className="h-6 w-14 bg-surface-container animate-pulse rounded" />
        </header>
        <main className="flex-1 flex flex-col items-center justify-center z-10 my-8">
          <div className="w-[240px] h-[240px] rounded-full border-4 border-dashed border-outline-variant/30 animate-spin flex items-center justify-center">
            <div className="h-10 w-24 bg-surface-container animate-pulse rounded" />
          </div>
        </main>
        <footer className="w-full max-w-[480px] flex flex-col items-center gap-6 z-10 flex-shrink-0">
          <div className="h-12 w-32 bg-surface-container animate-pulse rounded-full" />
        </footer>
      </div>
    );
  }

  const totalDuration = isBreak ? breakMinutes * 60 : focusMinutes * 60;
  const elapsedSeconds = totalDuration - secondsRemaining;
  const elapsedProgress = progressPercentage / 100;

  // SVG parameters
  const radius = 100;
  const circumference = 2 * Math.PI * radius; // ~628.3
  const strokeDashoffset = circumference - elapsedProgress * circumference;

  // Theme checking
  const isDark = mounted && resolvedTheme === "dark";
  const trackColor = isDark ? "#232630" : "#ECEEF1";
  
  // Choose stroke color: Primary for focus sessions, Tertiary for breaks
  const fillStrokeColor = isBreak
    ? (isDark ? "#4DDACF" : "#006761")
    : (isDark ? "#B1C5FF" : "#0054CB");

  // Format digital countdown string
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remaining.toString().padStart(2, "0")}`;
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <div className="min-h-screen bg-background relative flex flex-col items-center justify-between py-8 px-6 overflow-hidden font-sans">
      
      {/* Radial glow background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-primary/4 dark:bg-primary/8 rounded-full blur-[80px] pointer-events-none" />

      {/* Top Header Row */}
      <header className="w-full max-w-[480px] flex items-center justify-between z-10 flex-shrink-0">
        <button
          onClick={() => router.back()}
          className="text-primary hover:text-primary-container text-[14px] font-semibold outline-none focus-visible:underline"
        >
          Back
        </button>
        <span className="text-[14px] text-on-surface font-semibold truncate max-w-[65%] text-center">
          {commitmentTitle}
        </span>
        <button
          onClick={fastForward}
          className="text-xs text-outline hover:text-on-surface bg-surface-container px-2.5 py-1 rounded font-semibold transition"
          title="Fast forward to end of timer"
        >
          FF (5s)
        </button>
      </header>

      {/* Center Stage: Timer Ring & Countdown */}
      <main className="flex-1 flex flex-col items-center justify-center z-10 my-8">
        <div className="relative w-[240px] h-[240px] flex items-center justify-center">
          {/* SVG ring */}
          <svg width="240" height="240" className="absolute transform rotate-[-90deg]">
            {/* Background Track circle */}
            <circle
              cx="120"
              cy="120"
              r={radius}
              fill="transparent"
              stroke={trackColor}
              strokeWidth="10"
              className="transition-colors duration-300"
            />
            {/* Elapsed Fill circle */}
            <motion.circle
              cx="120"
              cy="120"
              r={radius}
              fill="transparent"
              stroke={fillStrokeColor}
              strokeWidth="10"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 0.2, ease: "linear" }}
              strokeLinecap="round"
              className="transition-colors duration-300"
            />
          </svg>

          {/* Centered Digital Countdown */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[36px] font-extrabold text-on-surface leading-none tracking-tight">
              {formatTime(secondsRemaining)}
            </span>
            <span className="text-[12px] font-semibold font-label text-outline uppercase tracking-widest mt-1">
              {isBreak ? "Break Time" : `${progressPercentage}% Done`}
            </span>
          </div>
        </div>

        {/* Info pills & current task metadata */}
        <div className="flex flex-col items-center mt-6 gap-2">
          <div className="bg-surface-container text-on-surface-variant text-[12px] font-semibold font-label rounded-full px-3 py-1 shadow-sm select-none">
            Session {sessionIndex} of 4
          </div>
          
          <span className="text-[12px] font-semibold font-label text-outline text-center max-w-[280px]">
            {isBreak ? "Taking a quick breather" : `Working on: ${commitmentTitle}`}
          </span>

          {/* Complete Task Trigger Button */}
          {!isBreak && (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleCompleteTask}
              className="mt-2.5 flex items-center gap-1.5 px-5 py-2 rounded-full bg-tertiary text-on-tertiary hover:bg-tertiary/90 text-[12px] font-bold font-label shadow-sm transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-tertiary"
            >
              <Check className="w-3.5 h-3.5 stroke-[3px]" />
              <span>Mark Task as Completed</span>
            </motion.button>
          )}
        </div>
      </main>

      {/* Timer Controls Row */}
      <footer className="flex items-center gap-6 z-10 flex-shrink-0 mb-4">
        {/* Stop Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleStop}
          className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
          title="Reset timer"
          aria-label="Reset timer"
        >
          <Square className="w-4 h-4 fill-current" />
        </motion.button>

        {/* Start / Pause Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleStartPause}
          className="w-16 h-16 rounded-full bg-primary hover:bg-primary/95 text-on-primary flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-lg"
          title={timerStatus === "running" ? "Pause timer" : "Start timer"}
          aria-label={timerStatus === "running" ? "Pause timer" : "Start timer"}
        >
          {timerStatus === "running" ? (
            <Pause className="w-6 h-6 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </motion.button>

        {/* Edit settings pencil Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowEditModal(true)}
          className="w-11 h-11 rounded-full bg-surface-container hover:bg-surface-container-high flex items-center justify-center text-on-surface-variant outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
          title="Edit timer settings"
          aria-label="Edit timer settings"
        >
          <Pencil className="w-4 h-4" />
        </motion.button>
      </footer>

      {/* SESSION COMPLETE MODAL */}
      <AnimatePresence>
        {showComplete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 z-50 flex flex-col justify-end"
          >
            {/* Modal Bottom Sheet overlay */}
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-surface-container-lowest rounded-t-[24px] shadow-modal p-8 w-full max-w-[480px] mx-auto flex flex-col gap-6 border-t border-outline-variant/30"
            >
              <div className="space-y-1.5 text-center">
                <h3 className="text-[18px] font-bold text-on-surface font-sans">
                  Session Complete!
                </h3>
                <p className="text-[14px] text-on-surface-variant font-sans">
                  How much did you progress?
                </p>
              </div>

              {/* Progress Slider block */}
              <div className="space-y-3 px-2">
                <div className="text-[20px] font-bold text-on-surface font-sans text-center">
                  {progressPercentage}% progress
                </div>
                
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressPercentage}
                  onChange={(e) => setProgressPercentage(Number(e.target.value))}
                  className="w-full accent-primary h-2 bg-surface-container rounded-lg appearance-none cursor-pointer outline-none"
                />
              </div>

              {/* Actions CTAs */}
              <div className="flex flex-col gap-3 pt-2">
                <PillButton
                  variant="primary"
                  onClick={handleLogProgress}
                  className="w-full h-12 text-sm font-semibold tracking-wide"
                >
                  Log Progress
                </PillButton>
                
                <PillButton
                  variant="outline"
                  onClick={handleStartBreak}
                  className="w-full h-12 text-sm font-semibold tracking-wide"
                >
                  Take a 5-min Break
                </PillButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* EDIT SETTINGS MODAL */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/90 z-50 flex flex-col justify-end"
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="bg-surface-container-lowest rounded-t-[24px] shadow-modal p-8 w-full max-w-[480px] mx-auto flex flex-col gap-5 border-t border-outline-variant/30 font-sans"
            >
              <div className="space-y-1.5 text-center">
                <h3 className="text-[18px] font-bold text-on-surface">
                  Timer Settings
                </h3>
                <p className="text-[14px] text-on-surface-variant">
                  Manually adjust focus and break periods
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold font-label text-outline uppercase tracking-wider">
                    Focus Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="180"
                    value={focusMinutes}
                    onChange={(e) => setFocusMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface focus:border-2 focus:border-primary focus:outline-none font-sans font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-bold font-label text-outline uppercase tracking-wider">
                    Break Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={breakMinutes}
                    onChange={(e) => setBreakMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg p-3 text-on-surface focus:border-2 focus:border-primary focus:outline-none font-sans font-semibold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 pt-2">
                <PillButton
                  variant="primary"
                  onClick={handleSaveSettings}
                  className="w-full h-12 text-sm font-semibold tracking-wide"
                >
                  Save Settings
                </PillButton>
                <PillButton
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                  className="w-full h-12 text-sm font-semibold tracking-wide"
                >
                  Cancel
                </PillButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
