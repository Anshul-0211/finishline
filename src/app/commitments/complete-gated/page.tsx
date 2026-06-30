"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Check, Loader2, AlertCircle, CalendarRange } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { motion, AnimatePresence } from "framer-motion";

function CompleteGatedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const commitmentId = searchParams.get("id");

  const { user, setUser, subscribeToUserProfile } = useUserStore();
  const { subscribeToCommitments, commitments } = useCommitmentsStore();

  const [authChecked, setAuthChecked] = useState(false);
  const [processing, setProcessing] = useState(true);
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Authenticating and verifying your commitment...");
  const [commitmentTitle, setCommitmentTitle] = useState("");

  // 1. Auth & Real-Time Sync Subscriptions
  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubCommitments: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setAuthChecked(true);
        router.push("/");
      } else {
        setUser(firebaseUser);
        setAuthChecked(true);
        
        // Open real-time Firestore subscriptions for active sync (State & Sync Checklist)
        unsubProfile = subscribeToUserProfile(firebaseUser.uid);
        unsubCommitments = subscribeToCommitments(firebaseUser.uid);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
      if (unsubCommitments) unsubCommitments();
    };
  }, [router, setUser, subscribeToUserProfile, subscribeToCommitments]);

  // 2. Perform Commitment Completion API Write once auth checked and user is available
  useEffect(() => {
    if (!authChecked || !user || !commitmentId) return;

    let isMounted = true;

    const activeUser = user;
    if (!activeUser) return;

    async function completeCommitment() {
      try {
        console.log(`[Complete Gated] Processing completion for commitment ID: ${commitmentId}...`);
        const idToken = await activeUser.getIdToken();
        const res = await fetch(`/api/commitments/complete?id=${commitmentId}`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json"
          }
        });

        const data = await res.json();

        if (!isMounted) return;

        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Your commitment has been successfully marked as completed!");
          
          // Find commitment title in store if synced
          const found = commitments.find(c => c.id === commitmentId);
          if (found) {
            setCommitmentTitle(found.title);
          } else {
            setCommitmentTitle("Work block successfully freed up");
          }

          // Redirect to dashboard after 3-second delay
          setTimeout(() => {
            if (isMounted) {
              router.push("/dashboard");
            }
          }, 3000);
        } else {
          setStatus("error");
          setMessage(data.error || "Failed to complete your commitment. Please try again.");
        }
      } catch (err: unknown) {
        console.error("[Complete Gated] API call failed:", err);
        if (isMounted) {
          setStatus("error");
          setMessage("A network error occurred while updating your status.");
        }
      } finally {
        if (isMounted) {
          setProcessing(false);
        }
      }
    }

    completeCommitment();

    return () => {
      isMounted = false;
    };
  }, [authChecked, user, commitmentId, router, commitments]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background Decorative Gradients */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-[500px] h-[500px] bg-teal-500/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container Card (max-w-md constraint) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center text-center space-y-6">
          
          {/* 1. STATE INDICATOR (Checkmark, Loader, or Error) */}
          <AnimatePresence mode="wait">
            {status === "loading" && (
              <motion.div
                key="loading-icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center border border-teal-500/30 text-teal-400"
              >
                <Loader2 className="w-10 h-10 animate-spin" />
              </motion.div>
            )}

            {status === "success" && (
              <motion.div
                key="success-icon"
                initial={{ scale: 0.5, rotate: -45, opacity: 0 }}
                animate={{ scale: [1.2, 1], rotate: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="w-24 h-24 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/40 text-emerald-400 shadow-lg shadow-emerald-500/10 relative"
              >
                <motion.svg
                  className="w-12 h-12 stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <motion.path
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ delay: 0.2, duration: 0.4, ease: "easeInOut" }}
                    d="M20 6L9 17l-5-5"
                  />
                </motion.svg>
              </motion.div>
            )}

            {status === "error" && (
              <motion.div
                key="error-icon"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="w-20 h-20 rounded-full bg-rose-500/10 flex items-center justify-center border border-rose-500/30 text-rose-400"
              >
                <AlertCircle className="w-10 h-10" />
              </motion.div>
            )}
          </AnimatePresence>

          {/* 2. TEXT CONTAINER with robust Wrapping (break-words) */}
          <div className="space-y-3 w-full px-2">
            <h1 className="text-2xl font-bold tracking-tight text-white text-wrap break-words">
              {status === "loading" && "Processing Completion"}
              {status === "success" && "Fantastic Achievement!"}
              {status === "error" && "Action Failed"}
            </h1>
            
            {commitmentTitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-emerald-400/90 font-medium text-sm px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 inline-block max-w-full truncate"
              >
                {commitmentTitle}
              </motion.p>
            )}

            <p className="text-slate-400 text-sm leading-relaxed text-wrap break-words max-h-[120px] overflow-y-auto">
              {message}
            </p>
          </div>

          {/* 3. SUBTITLE / SCHEDULE CLEARING NOTICE */}
          {status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center space-x-2 text-slate-500 text-xs bg-slate-950/40 px-4 py-2 rounded-xl border border-slate-800/60"
            >
              <CalendarRange className="w-4 h-4 text-teal-500 animate-pulse" />
              <span>Corresponding calendar events cleared.</span>
            </motion.div>
          )}

          {/* 4. LOADING PROGRESS BAR */}
          <div className="w-full bg-slate-950/60 h-1.5 rounded-full overflow-hidden border border-slate-800/40">
            {status === "loading" ? (
              <div className="bg-teal-500 h-full w-[40%] rounded-full animate-[shimmer_1.5s_infinite_linear]" 
                   style={{
                     backgroundImage: "linear-gradient(to right, #06b6d4, #14b8a6, #06b6d4)",
                     backgroundSize: "200% 100%"
                   }}
              />
            ) : status === "success" ? (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 3, ease: "linear" }}
                className="bg-emerald-500 h-full rounded-full"
              />
            ) : (
              <div className="bg-rose-500 h-full w-full rounded-full opacity-60" />
            )}
          </div>

          {/* 5. DIRECT REDIRECT FOOTER */}
          {(status === "success" || status === "error") && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push("/dashboard")}
              className="text-xs text-teal-400 hover:text-teal-300 font-medium transition-colors"
            >
              Go to Dashboard now &rarr;
            </motion.button>
          )}

        </div>
      </motion.div>
    </div>
  );
}

export default function CompleteGatedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-teal-500" />
          <p className="text-sm">Loading FinishLine Gate...</p>
        </div>
      </div>
    }>
      <CompleteGatedContent />
    </Suspense>
  );
}
