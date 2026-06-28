"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { MessageInput } from "@/components/message-input";
import { ProposedScheduleCard } from "@/components/proposed-schedule-card";
import { RiskBadge } from "@/components/ui/risk-badge";
import { PillButton } from "@/components/ui/pill-button";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  hasSchedule?: boolean;
}

export default function RenegotiationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, userProfile } = useUserStore();
  const { commitments } = useCommitmentsStore();

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "system-1",
      role: "assistant",
      content: "I'm here to help renegotiate this commitment. What's going on?",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [showScheduleTest, setShowScheduleTest] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Find commitment details from store, fallback for verification page
  const commitment = commitments.find((c) => c.id === params.id);
  const commitmentTitle = commitment?.title || "OS Memory Allocator Assignment";
  const riskScore = commitment?.riskScore || 92;

  const handleSend = (text: string) => {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    // Trigger mock response
    setTimeout(() => {
      const responseContent = text.toLowerCase().includes("schedule") || text.toLowerCase().includes("plan")
        ? "Understood. I have evaluated your competing commitments and assembled a proposed conflict-free schedule adjust block for your review:"
        : "I understand that you got busy. Let's analyze your calendar to find a suitable adjustment window for this commitment.";

      const hasSchedule = text.toLowerCase().includes("schedule") || text.toLowerCase().includes("plan");

      const aiMsg: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: responseContent,
        hasSchedule,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setLoading(false);
    }, 1500);
  };

  const handleMockScheduleConfirm = () => {
    alert("New proposed schedule confirmed!");
    const confirmMsg: Message = {
      id: `system-${Date.now()}`,
      role: "assistant",
      content: "Schedule update complete. Your calendar slots have been reallocated and risk scores updated.",
    };
    setMessages((prev) => [...prev, confirmMsg]);
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";

  const mockBlocks = [
    { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1).toISOString().split("T")[0], durationMinutes: 120, goal: "Complete memory allocators logic draft" },
    { date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString().split("T")[0], durationMinutes: 90, goal: "Debug boundary conditions and memory leaks" }
  ];

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

        {/* Debug Test Controller */}
        <div className="bg-surface-container-low px-4 py-2 border-b border-outline-variant flex items-center justify-between text-xs text-on-surface-variant font-label">
          <span>Test Helpers:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setShowScheduleTest(!showScheduleTest)}
              className="px-2 py-1 rounded bg-surface-container-highest hover:bg-surface-dim transition font-semibold"
            >
              Toggle Schedule Card
            </button>
            <button
              onClick={() => {
                setLoading(true);
                setTimeout(() => setLoading(false), 2000);
              }}
              className="px-2 py-1 rounded bg-surface-container-highest hover:bg-surface-dim transition font-semibold"
            >
              Trigger Loading State
            </button>
          </div>
        </div>

        {/* Chat thread area */}
        <div className="flex-1 overflow-y-auto px-4 py-6 flex flex-col gap-4 min-h-0 bg-background/50">
          <AnimatePresence initial={false}>
            {messages.map((message) => (
              <motion.div
                key={message.id}
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

                    {/* Render attachment schedule card if triggered */}
                    {message.hasSchedule && (
                      <div className="pl-9.5 w-full">
                        <ProposedScheduleCard
                          summary="Here is the revised schedule block allocation that avoids all other active commitments:"
                          blocks={mockBlocks}
                          newDeadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 4).toISOString()}
                          conflictsAvoided={["OS Assignment overlaps with Birthday Celebration"]}
                          onConfirm={handleMockScheduleConfirm}
                          onSuggestAlternative={() => alert("Alternative suggestion requested")}
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}

            {/* Test Proposed Schedule Card attachment outside chat mapping */}
            {showScheduleTest && (
              <motion.div
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                className="pl-9.5 max-w-[85%] self-start w-full"
              >
                <ProposedScheduleCard
                  summary="Proposed schedule adjustment block for your review:"
                  blocks={mockBlocks}
                  newDeadline={new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString()}
                  conflictsAvoided={["OS Assignment overlaps with Birthday Celebration"]}
                  onConfirm={handleMockScheduleConfirm}
                  onSuggestAlternative={() => alert("Alternative suggestion requested")}
                />
              </motion.div>
            )}

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

        {/* Message Input Sticky Bar */}
        <MessageInput
          onSend={handleSend}
          placeholder="Type to explain or type 'schedule' to test schedule proposal..."
        />
      </div>
    </NavShell>
  );
}
