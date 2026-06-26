"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { db } from "@/lib/firebase/client";
import { doc, onSnapshot, updateDoc, arrayUnion } from "firebase/firestore";
import Link from "next/link";
import { ArrowLeft, Send, Sparkles, Calendar, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function RenegotiationPage() {
  const { renegotiationId } = useParams() as { renegotiationId: string };
  const { user } = useUserStore();
  const router = useRouter();

  const [renegDoc, setRenegDoc] = useState<any | null>(null);
  const [commitment, setCommitment] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Success states
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Subscribe to renegotiation document
  useEffect(() => {
    if (!user?.uid || !renegotiationId) return;

    let unsubCommit: (() => void) | null = null;

    const renegRef = doc(db, "users", user.uid, "renegotiations", renegotiationId);
    const unsubscribe = onSnapshot(renegRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setRenegDoc({ id: snap.id, ...data });
        setMessages(data.messages || []);

        // Fetch commitment title (only subscribe once)
        if (data.commitmentId && !unsubCommit) {
          const commitRef = doc(db, "users", user.uid, "commitments", data.commitmentId);
          unsubCommit = onSnapshot(commitRef, (cSnap) => {
            if (cSnap.exists()) {
              setCommitment({ id: cSnap.id, ...cSnap.data() });
            }
          });
        }
      }
      setPageLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubCommit) unsubCommit();
    };
  }, [user, renegotiationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || !user?.uid || !renegotiationId) return;

    setLoading(true);
    setInputText("");

    const userMsg = {
      role: "user",
      content: text,
      timestamp: new Date().toISOString(), // optimistic
    };

    // Optimistically update local messages list
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai/renegotiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renegotiationId,
          message: text,
          userId: user.uid,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to process message");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSchedule = async () => {
    if (!user?.uid || !renegotiationId) return;
    setConfirmingSchedule(true);
    try {
      const res = await fetch("/api/ai/renegotiate/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          renegotiationId,
          userId: user.uid,
        }),
      });

      if (res.ok) {
        setConfirmSuccess(true);
        setTimeout(() => {
          router.push(`/dashboard/commitments/${commitment?.id}`);
        }, 2000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setConfirmingSchedule(false);
    }
  };

  const quickReplies = [
    "Got busy with other tasks",
    "Underestimated effort required",
    "An emergency came up",
    "I need more time to finish",
  ];

  if (pageLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#8B949E]">Initializing renegotiation chat...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] lg:h-[calc(100vh-80px)] text-white relative">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-[#30363D] pb-4 shrink-0">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-[#21262D] rounded-xl text-[#8B949E] hover:text-white transition cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-500 border-amber-500/20">
            Renegotiation Dialogue
          </span>
          <h1 className="text-lg font-bold mt-1 text-white truncate max-w-xs md:max-w-md">
            Renegotiating: {commitment?.title || "Commitment"}
          </h1>
        </div>
      </header>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto py-6 space-y-4 pr-2">
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => {
            const isAI = msg.role === "assistant";
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${isAI ? "justify-start" : "justify-end"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl p-4 shadow-sm text-sm border ${
                    isAI
                      ? "bg-[#21262D] text-white border-[#30363D] rounded-tl-none"
                      : "bg-[#1f2937] text-white border-[#374151] rounded-tr-none"
                  }`}
                >
                  {isAI && (
                    <div className="flex items-center gap-1.5 text-blue-400 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>FinishLine Coach</span>
                    </div>
                  )}
                  <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                </div>
              </motion.div>
            );
          })}

          {/* Thinking loader */}
          {loading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="bg-[#21262D] border border-[#30363D] rounded-2xl rounded-tl-none p-4 flex items-center gap-2 text-xs text-[#8B949E]">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                <span>FinishLine is planning...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proposed Schedule Block inside chat if it exists */}
        {renegDoc?.proposedSchedule && renegDoc.status === "open" && !loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="border-2 border-amber-500/30 bg-amber-500/5 rounded-2xl p-5 space-y-4 max-w-md mx-auto"
          >
            <div className="flex items-center gap-2 text-amber-500 font-bold text-sm">
              <Calendar className="w-5 h-5" />
              <span>Proposed Reschedule Details</span>
            </div>
            
            <div className="space-y-3">
              {renegDoc.proposedSchedule.steps.map((block: any, idx: number) => {
                const dateStr = new Date(block.date).toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <div key={idx} className="bg-[#161B22] border border-[#30363D] p-3 rounded-xl text-xs">
                    <p className="font-semibold text-white">{block.description}</p>
                    <p className="text-[#8B949E] mt-0.5">
                      {dateStr} • {block.duration} minutes slot
                    </p>
                  </div>
                );
              })}
            </div>

            {confirmSuccess ? (
              <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold">
                <Check className="w-4 h-4" />
                <span>Calendar updated successfully! Redirecting...</span>
              </div>
            ) : (
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => handleSendMessage("Suggest different times")}
                  className="py-2 px-4 rounded-xl bg-[#21262D] border border-[#30363D] hover:border-[#8b949e]/40 text-xs font-semibold cursor-pointer"
                >
                  Suggest different times
                </button>
                <button
                  onClick={handleConfirmSchedule}
                  disabled={confirmingSchedule}
                  className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-md transition duration-200 cursor-pointer flex items-center gap-1.5"
                >
                  {confirmingSchedule && (
                    <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>Confirm New Schedule</span>
                </button>
              </div>
            )}
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input / quick reply bar */}
      <div className="border-t border-[#30363D] pt-4 shrink-0 bg-[#0D1117] space-y-4">
        {/* Quick replies */}
        {messages.length > 0 && renegDoc?.status === "open" && !loading && (
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
            {quickReplies.map((reply, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(reply)}
                className="py-2 px-4 bg-[#21262D] hover:bg-[#30363D] border border-[#30363D] hover:border-blue-500 text-white rounded-full text-xs font-medium shrink-0 transition cursor-pointer"
              >
                {reply}
              </button>
            ))}
          </div>
        )}

        {/* Input box */}
        <div className="flex items-center gap-3 relative pb-4">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage(inputText)}
            placeholder={
              renegDoc?.status === "open"
                ? "Type your response..."
                : "This conversation has resolved."
            }
            disabled={loading || renegDoc?.status !== "open"}
            className="flex-1 bg-[#161B22] border border-[#30363D] focus:border-blue-500 rounded-xl px-4 py-3.5 text-white text-sm focus:outline-none transition pr-12"
          />
          <button
            onClick={() => handleSendMessage(inputText)}
            disabled={loading || !inputText.trim() || renegDoc?.status !== "open"}
            className="absolute right-3 p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800/40 disabled:text-white/30 rounded-lg text-white transition cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
