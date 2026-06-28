"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { CommitmentCard } from "@/components/commitment-card";

export default function CommitmentsPage() {
  const router = useRouter();
  const { user, userProfile } = useUserStore();

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const mockCommitments = [
    {
      id: "evt-1",
      title: "OS Assignment Prep Block",
      domain: "academic" as const,
      status: "active" as const,
      priority: "critical" as const,
      deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      completionPercentage: 35,
      riskScore: 82,
      riskTrend: "stable" as const,
    },
    {
      id: "evt-2",
      title: "Sarah's Birthday Celebration",
      domain: "social" as const,
      status: "active" as const,
      priority: "medium" as const,
      deadline: new Date(Date.now() + 86400000 * 2).toISOString(),
      completionPercentage: 100,
      riskScore: 15,
      riskTrend: "stable" as const,
    },
    {
      id: "evt-3",
      title: "Mock Interview Recruiter session",
      domain: "work" as const,
      status: "active" as const,
      priority: "high" as const,
      deadline: new Date(Date.now() + 86400000 * 4).toISOString(),
      completionPercentage: 0,
      riskScore: 45,
      riskTrend: "stable" as const,
    }
  ];

  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-1/2 mx-auto px-6 py-6 flex flex-col gap-6 font-sans">
        
        {/* Header */}
        <header className="flex items-center gap-3">
          <button
            onClick={() => router.push("/calendar")}
            className="p-2 -ml-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Go back to Calendar"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-[26px] font-bold text-on-surface tracking-[-0.01em] leading-none">
            All Commitments
          </h1>
        </header>

        {/* Commitment Cards Stack */}
        <div className="flex flex-col gap-4">
          {mockCommitments.map((commitment) => (
            <CommitmentCard
              key={commitment.id}
              id={commitment.id}
              title={commitment.title}
              domain={commitment.domain}
              status={commitment.status}
              priority={commitment.priority}
              deadline={commitment.deadline}
              completionPercentage={commitment.completionPercentage}
              riskScore={commitment.riskScore}
              riskTrend={commitment.riskTrend}
            />
          ))}
        </div>

      </div>
    </NavShell>
  );
}
