"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Plus } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { SkeletonRow } from "@/components/ui/skeleton-row";

export default function DashboardPage() {
  const router = useRouter();
  const { user, setUser, subscribeToUserProfile, userProfile } = useUserStore();
  const { commitments, loading: commitmentsLoading, subscribeToCommitments } = useCommitmentsStore();
  const [authChecked, setAuthChecked] = useState(false);

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
        
        // Open real-time Firestore subscriptions
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

  const isLoading = !authChecked || commitmentsLoading;
  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <NavShell displayName={displayName}>
      <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8">
        
        {isLoading ? (
          <div className="space-y-6">
            <SkeletonRow height={120} />
            <SkeletonRow height={120} />
            <SkeletonRow height={120} />
          </div>
        ) : commitments.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center gap-2">
            <p className="text-on-surface-variant font-sans text-[16px]">
              No active commitments yet ↘️
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* STRESS_GAUGE_SECTION */}
            {/* COLLISION_BANNER_SECTION */}
            {/* GMAIL_SCAN_SECTION */}
            {/* COMMITMENT_CARDS_SECTION */}
            {/* LIFE_BALANCE_RADAR_SECTION */}
          </div>
        )}

        {/* Floating Action Button (FAB) */}
        <button
          onClick={() => router.push("/add")}
          className="fixed bottom-[96px] right-4 z-30 w-14 h-14 bg-primary text-on-primary rounded-full flex items-center justify-center shadow-card hover:bg-primary-container active:scale-95 transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Add new commitment"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </NavShell>
  );
}
