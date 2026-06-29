"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { CommitmentCard } from "@/components/commitment-card";

export default function CommitmentsPage() {
  const router = useRouter();
  const { user, setUser, userProfile } = useUserStore();
  const { commitments, subscribeToCommitments } = useCommitmentsStore();

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
    if (!user) return;
    const unsubscribe = subscribeToCommitments(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToCommitments]);

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
          {commitments.length === 0 ? (
            <div className="text-center py-12 text-on-surface-variant font-label text-sm">
              No commitments found. Add one to get started!
            </div>
          ) : (
            commitments.map((commitment) => (
              <CommitmentCard
                key={commitment.id}
                id={commitment.id}
                title={commitment.title}
                domain={commitment.domain}
                status={["active", "completed", "missed", "deferred"].includes(commitment.status) ? (commitment.status as any) : "active"}
                priority={commitment.priority || "medium"}
                deadline={typeof commitment.deadline === "string" ? commitment.deadline : (commitment.deadline as any)?.toISOString?.() || ""}
                completionPercentage={commitment.completionPercentage}
                riskScore={commitment.riskScore || 0}
                riskTrend={commitment.riskTrend || "stable"}
                onFocusClick={() => router.push(`/focus/${commitment.id}`)}
                onWhyClick={() => router.push("/dashboard")}
              />
            ))
          )}
        </div>

      </div>
    </NavShell>
  );
}
