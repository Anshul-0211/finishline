"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Check } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { useRenegotiationStore } from "@/lib/stores/useRenegotiationStore";
import { NavShell } from "@/components/nav-shell";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { MessageInput } from "@/components/message-input";
import { ProposedScheduleCard } from "@/components/proposed-schedule-card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { PillButton } from "@/components/ui/pill-button";

export default function RenegotiationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, setUser, userProfile } = useUserStore();
  const { commitments, loading: commitmentsLoading, subscribeToCommitments } = useCommitmentsStore();
  const [initDone, setInitDone] = useState(false);

  const {
    messages,
    loading,
    confirmed,
    proposedSchedule,
    newDeadline,
    conflictsAvoided,
    error,
    addMessage,
    setLoading,
    setProposedSchedule,
    setConfirmed,
    setError,
    reset,
  } = useRenegotiationStore();

  const [latestResponse, setLatestResponse] = useState<{
    requiresUserReview?: boolean;
    reviewReason?: string | null;
    aiMeta?: {
      confidence: number;
      confidenceLabel: "low" | "medium" | "high" | "very_high";
      reasoning: string;
    };
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  // ON MOUNT: Init store with personalized system opener after commitments load
  useEffect(() => {
    if (!user || commitmentsLoading) return;

    const commitment = commitments.find((c) => c.id === params.id);
    if (!commitment) {
      router.push("/dashboard");
      return;
    }

    if (!initDone) {
      useRenegotiationStore.setState({
        messages: [
          {
            role: "system",
            content: `I'm here to help renegotiate "${commitment.title}". What's going on?`,
          },
        ],
        proposedSchedule: null,
        newDeadline: null,
        conflictsAvoided: [],
        error: null,
        confirmed: false,
      });
      setInitDone(true);
    }
  }, [params.id, commitments, commitmentsLoading, user, router, initDone]);

  // Clean up store on unmount
  useEffect(() => {
    return () => reset();
  }, [reset]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const commitment = commitments.find((c) => c.id === params.id);
  const commitmentTitle = commitment?.title || "Commitment";
  const riskScore = commitment?.riskScore || 0;

  const showSkeleton = !user || commitmentsLoading || !initDone;

  if (showSkeleton) {
    const displayName = userProfile?.displayName || user?.displayName || "User";
    return (
      <NavShell displayName={displayName} hideBottomNav={true}>
        <div className="flex-1 flex flex-col h-[calc(100vh-64px)] max-w-[720px] mx-auto w-full border-x border-outline-variant bg-background overflow-hidden relative font-sans">
          <header className="bg-surface-container-lowest border-b border-outline-variant shadow-card px-4 py-3 flex items-center justify-between z-10 flex-shrink-0">
            <div className="h-5 w-12 bg-surface-container animate-pulse rounded" />
            <div className="flex flex-col items-center gap-1.5 w-1/3">
              <div className="h-3 w-16 bg-surface-container animate-pulse rounded" />
              <div className="h-5 w-24 bg-surface-container animate-pulse rounded" />
            </div>
            <div className="h-8 w-12 bg-surface-container animate-pulse rounded-full" />
          </header>
          <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-6 min-h-0 bg-background/50">
            <div className="w-2/3 h-16 bg-surface-container-low border border-outline-variant/30 animate-pulse rounded-2xl self-start" />
            <div className="w-1/2 h-12 bg-surface-container-low border border-outline-variant/30 animate-pulse rounded-2xl self-end" />
            <div className="w-2/3 h-20 bg-surface-container-low border border-outline-variant/30 animate-pulse rounded-2xl self-start" />
          </div>
        </div>
      </NavShell>
    );
  }

  // Send Message Flow
  const handleSend = async (userText: string) => {
    if (!user || !userText.trim()) return;
    setError(null);
    addMessage("user", userText);
    setLoading(true);

    try {
      const currentMessages = useRenegotiationStore.getState().messages;
      const res = await fetch("/api/ai/renegotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          commitmentId: params.id,
          messages: currentMessages,
          confirm: false,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      addMessage("assistant", data.message);

      setLatestResponse({
        requiresUserReview: data.requiresUserReview,
        reviewReason: data.reviewReason,
        aiMeta: data.aiMeta,
      });

      if (data.hasProposedSchedule && data.proposedSchedule) {
        setProposedSchedule(data.proposedSchedule, data.newDeadline, data.conflictsAvoided);
      }
    } catch (e: any) {
      setError(e.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Confirm Flow
  const handleConfirm = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const currentMessages = useRenegotiationStore.getState().messages;
      const res = await fetch("/api/ai/renegotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.uid,
          commitmentId: params.id,
          messages: currentMessages,
          confirm: true,
          proposedSchedule,
          newDeadline,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setConfirmed(true);
    } catch (e: any) {
      setError(e.message ?? "Confirmation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  // Identify last assistant message to attach schedule card inline
  const lastAssistantIndex = [...messages]
    .reverse()
    .findIndex((m) => m.role === "assistant" || m.role === "system");
  const lastAssistantMsgId =
    lastAssistantIndex !== -1 ? messages[messages.length - 1 - lastAssistantIndex] : null;

  return (
    <NavShell displayName={displayName} hideBottomNav={true}>
      <div className="flex-1 flex flex-col h-[calc(100vh-64px)] max-w-[720px] mx-auto w-full border-x border-outline-variant bg-background overflow-hidden relative">
        {/* Chat screen header */}
        <header className="bg-surface-container-lowest border-b border-outline-variant shadow-card px-4 py-3 flex items-center justify-between z-10 flex-shrink-0">
          <button
            onClick={() => router.back()}
            className="text-primary hover:text-primary-container text-[14px] font-sans font-semibold outline-none focus-visible:underline"
          >
            Back
          </button>

          <div className="flex flex-col items-center max-w-[60%] text-center">
            <span className="text-[12px] font-semibold font-label text-on-surface-variant uppercase tracking-wider leading-none mb-1">
              Renegotiating
            </span>
            <h2 className="text-[16px] font-bold text-on-surface font-sans truncate w-full" title={commitmentTitle}>
              {commitmentTitle}
            </h2>
          </div>

          <div className="flex-shrink-0">
            <RiskBadge score={riskScore} />
          </div>
        </header>

        {/* Low Confidence Warning Banner */}
        {latestResponse?.aiMeta?.confidence !== undefined && latestResponse.aiMeta.confidence < 0.5 && (
          <div className="px-4 pt-4 flex-shrink-0">
            <AmberReviewBanner message={latestResponse.reviewReason ?? `Low AI Confidence (${Math.round(latestResponse.aiMeta.confidence * 100)}%): ${latestResponse.aiMeta.reasoning}`} />
          </div>
        )}

        {/* Chat thread area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 min-h-0 bg-background/50">
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isLastAssistant =
                lastAssistantMsgId &&
                message.role === lastAssistantMsgId.role &&
                message.content === lastAssistantMsgId.content;

              return (
                <motion.div
                  key={index}
                  initial={{ y: 8, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 8, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`flex flex-col ${message.role === "user" ? "items-end" : "items-start"} w-full`}
                >
                  {message.role === "user" ? (
                    /* User Bubble */
                    <div className="max-w-[75%] bg-primary/10 rounded-[18px_18px_4px_18px] px-4 py-3 text-[16px] text-on-surface font-sans leading-relaxed border border-primary/20 shadow-sm">
                      {message.content}
                    </div>
                  ) : (
                    /* Assistant Bubble Group */
                    <div className="flex flex-col gap-3 max-w-[85%]">
                      <div className="flex items-start gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-sans font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm select-none">
                          AI
                        </div>
                        <div className="bg-surface-container-lowest border border-outline-variant shadow-card rounded-[18px_18px_18px_4px] px-4 py-3 text-[16px] text-on-surface font-sans leading-relaxed">
                          {message.content}
                        </div>
                      </div>

                      {/* Render proposed schedule card if this is the last assistant message and a schedule exists */}
                      {isLastAssistant && proposedSchedule && (
                        <div className="pl-9.5 w-full">
                          <ProposedScheduleCard
                            summary={proposedSchedule.summary}
                            blocks={proposedSchedule.blocks.map((b: any) => {
                              const start = new Date(b.start || b.date);
                              const end = new Date(b.end || b.date);
                              const durationMinutes = isNaN(start.getTime()) || isNaN(end.getTime())
                                ? 60
                                : Math.round((end.getTime() - start.getTime()) / 60000);
                              return {
                                date: b.start || b.date || new Date().toISOString(),
                                durationMinutes,
                                goal: b.goal || "Scheduled work block",
                              };
                            })}
                            newDeadline={newDeadline}
                            conflictsAvoided={conflictsAvoided}
                            requiresUserReview={latestResponse?.requiresUserReview}
                            reviewReason={latestResponse?.reviewReason}
                            aiMeta={latestResponse?.aiMeta}
                            onConfirm={handleConfirm}
                            onSuggestAlternative={() => handleSend("Can you suggest an alternative schedule?")}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              );
            })}

            {/* Typing Indicator */}
            {loading && (
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                className="flex items-start gap-2.5 self-start max-w-[80%] mt-1"
              >
                <div className="w-7 h-7 rounded-full bg-primary text-on-primary font-sans font-bold flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm select-none">
                  AI
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant shadow-card rounded-[18px_18px_18px_4px] px-4 py-3 flex items-center gap-1.5">
                  <motion.span
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0 }}
                    className="w-1.5 h-1.5 bg-outline rounded-full"
                  />
                  <motion.span
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}
                    className="w-1.5 h-1.5 bg-outline rounded-full"
                  />
                  <motion.span
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}
                    className="w-1.5 h-1.5 bg-outline rounded-full"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Error banner */}
        {error && (
          <div className="mx-4 mb-3 p-3 bg-error-container text-on-error-container rounded-xl flex items-center justify-between text-sm font-semibold font-sans border border-error/20">
            <span className="truncate pr-4">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-primary hover:underline font-bold text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* Message Input Sticky Bar */}
        <MessageInput
          onSend={handleSend}
          disabled={loading || confirmed}
          placeholder="Type to explain why you are delayed..."
        />

        {/* Success Overlay */}
        {confirmed && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6 text-center font-sans">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-surface-container-low border border-outline-variant rounded-[32px] p-8 max-w-[400px] w-full shadow-card flex flex-col items-center gap-6"
            >
              <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Check className="w-8 h-8 stroke-[3px]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-[24px] font-bold text-on-surface">
                  Schedule Updated!
                </h3>
                <p className="text-[14px] text-on-surface-variant leading-relaxed">
                  Your renegotiation was successful. {proposedSchedule?.summary || "The commitment schedule and deadline have been updated."}
                </p>
              </div>

              <PillButton
                variant="primary"
                onClick={() => {
                  reset();
                  router.push("/dashboard");
                }}
                className="w-full h-12 text-sm font-semibold mt-2"
              >
                Back to Dashboard
              </PillButton>
            </motion.div>
          </div>
        )}
      </div>
    </NavShell>
  );
}
