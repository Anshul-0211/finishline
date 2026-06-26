"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CheckSquare, 
  Search, 
  Calendar, 
  AlertCircle, 
  Plus, 
  CheckCircle2, 
  XCircle,
  Clock
} from "lucide-react";

interface Commitment {
  id: string;
  title: string;
  description: string;
  domain: "academic" | "work" | "personal" | "health" | "social" | "family";
  deadline: any;
  riskScore: number;
  calendarSyncStatus: "synced" | "pending";
  completionPercentage: number;
  status: "active" | "completed" | "cancelled" | "missed";
}

const DOMAIN_COLORS: Record<string, string> = {
  academic: "bg-[#4A90D9]/10 text-[#4A90D9] border-[#4A90D9]/20",
  work: "bg-[#9B59B6]/10 text-[#9B59B6] border-[#9B59B6]/20",
  personal: "bg-[#E67E22]/10 text-[#E67E22] border-[#E67E22]/20",
  health: "bg-[#27AE60]/10 text-[#27AE60] border-[#27AE60]/20",
  social: "bg-[#E91E63]/10 text-[#E91E63] border-[#E91E63]/20",
  family: "bg-[#795548]/10 text-[#795548] border-[#795548]/20",
};

function formatDeadline(deadlineVal: any): string {
  if (!deadlineVal) return "No deadline";
  const date = new Date(
    typeof deadlineVal.toDate === "function" ? deadlineVal.toDate() : deadlineVal
  );
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CommitmentsPage() {
  const { user } = useUserStore();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "completed" | "cancelled">("all");

  useEffect(() => {
    if (!user?.uid) return;

    const commitmentsRef = collection(db, "users", user.uid, "commitments");
    const unsubscribe = onSnapshot(
      commitmentsRef,
      (querySnap) => {
        const list: Commitment[] = [];
        querySnap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as Commitment);
        });
        setCommitments(list);
        setLoading(false);
      },
      (error) => {
        console.error("Error subscribing to commitments:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const filtered = commitments.filter((item) => {
    const matchesSearch = item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          item.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterStatus === "all" || item.status === filterStatus;
    
    return matchesSearch && matchesFilter;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />;
      case "cancelled": return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
      case "missed": return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
      default: return <Clock className="w-4 h-4 text-blue-400 shrink-0" />;
    }
  };

  const getRiskBadgeColor = (risk: number) => {
    if (risk > 70) return "text-red-400 bg-red-400/10 border-red-500/20";
    if (risk > 40) return "text-amber-400 bg-amber-400/10 border-amber-500/20";
    return "text-green-400 bg-green-400/10 border-green-500/20";
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 text-foreground">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Your Commitments</h1>
          <p className="text-sm text-[#8B949E] mt-1">
            Track and manage all commitments, deadlines, and task plans.
          </p>
        </div>
        <Link
          href="/dashboard/add"
          className="flex items-center gap-2 py-2.5 px-5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition duration-200 text-sm cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Commitment</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card border border-border p-4 rounded-2xl">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search commitments..."
            className="w-full bg-background border border-border pl-10 pr-4 py-2 rounded-xl text-sm focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        <div className="flex bg-background p-1 rounded-xl border border-border w-full md:w-auto overflow-x-auto shrink-0">
          {(["all", "active", "completed", "cancelled"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`flex-1 md:flex-none text-xs font-semibold py-2 px-4 rounded-lg transition duration-150 capitalize cursor-pointer whitespace-nowrap ${
                filterStatus === status
                  ? "bg-secondary text-blue-400 border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Commitments List */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-4"
          >
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-[#161B22] border border-[#30363D] rounded-2xl animate-pulse" />
            ))}
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#161B22] border border-[#30363D] rounded-2xl p-16 text-center flex flex-col items-center justify-center space-y-4 shadow-sm"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
              <CheckSquare className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-foreground font-bold text-lg">No commitments found</h4>
              <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto leading-relaxed">
                {searchQuery || filterStatus !== "all" 
                  ? "No commitments match your search parameters. Try broadening your criteria." 
                  : "Add your first commitment to allow FinishLine to begin planning and tracking."}
              </p>
            </div>
            {!searchQuery && filterStatus === "all" && (
              <Link
                href="/dashboard/add"
                className="flex items-center gap-2 py-2 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold shadow-md transition duration-200 text-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create New</span>
              </Link>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial="hidden"
            animate="show"
            variants={{
              hidden: { opacity: 0 },
              show: {
                opacity: 1,
                transition: { staggerChildren: 0.05 },
              },
            }}
            className="space-y-4"
          >
            {filtered.map((item) => (
              <motion.div
                key={item.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
              >
                <Link
                  href={`/dashboard/commitments/${item.id}`}
                  className="block bg-card border border-border hover:border-[#8b949e]/40 rounded-2xl p-5 shadow-sm transition duration-200 group"
                >
                  <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {getStatusIcon(item.status)}
                        <h4 className="text-base font-bold text-foreground group-hover:text-blue-400 transition truncate max-w-xs md:max-w-md">
                          {item.title}
                        </h4>
                        <span className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border ${DOMAIN_COLORS[item.domain] || "bg-gray-800 text-gray-400"}`}>
                          {item.domain}
                        </span>
                      </div>
                      
                      {item.description && (
                        <p className="text-xs text-[#8B949E] line-clamp-2 max-w-2xl leading-relaxed">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4 shrink-0 text-xs font-semibold w-full md:w-auto justify-between md:justify-end border-t border-border pt-3.5 md:border-none md:pt-0">
                      {/* Deadline */}
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formatDeadline(item.deadline)}</span>
                      </div>

                      {/* Progress */}
                      {item.status === "active" && (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground uppercase">Progress</span>
                          <span className="text-foreground font-black">{item.completionPercentage || 0}%</span>
                        </div>
                      )}

                      {/* Risk Score */}
                      {item.status === "active" && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] uppercase font-black ${getRiskBadgeColor(item.riskScore)}`}>
                          <span>Risk: {item.riskScore}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
