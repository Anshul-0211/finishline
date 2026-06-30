"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Plus, Mail, RefreshCw, Loader2 } from "lucide-react";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { SkeletonRow } from "@/components/ui/skeleton-row";
import { StressArc } from "@/components/ui/stress-arc";
import { CollisionBanner } from "@/components/collision-banner";
import { CommitmentCard } from "@/components/commitment-card";
import { RiskExplanationModal } from "@/components/risk-explanation-modal";
import { LifeBalanceRadar } from "@/components/life-balance-radar";
import { GmailSuggestionCard } from "@/components/gmail-suggestion-card";
import { AmberReviewBanner } from "@/components/ui/amber-review-banner";
import { PillButton } from "@/components/ui/pill-button";
import { createCommitment } from "@/lib/firestore";
import { serverTimestamp } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";

export default function DashboardPage() {
  const router = useRouter();
  const { user, setUser, subscribeToUserProfile, userProfile, profileLoading } = useUserStore();
  const { commitments, loading: commitmentsLoading, subscribeToCommitments } = useCommitmentsStore();
  const [authChecked, setAuthChecked] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Risk modal states
  const [selectedCommitmentId, setSelectedCommitmentId] = useState<string | null>(null);
  const [riskExplanationData, setRiskExplanationData] = useState<any>(null);
  const [riskModalLoading, setRiskModalLoading] = useState(false);
  const [riskModalError, setRiskModalError] = useState<string | null>(null);

  // Gmail Scan states
  const [gmailSuggestions, setGmailSuggestions] = useState<any[]>([]);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailDismissed, setGmailDismissed] = useState<Set<string>>(new Set());

  // Calendar Sync states
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleCalendarSync = async () => {
    if (!user) return;
    setSyncLoading(true);
    setSyncError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/calendar/sync", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid }),
      });
      if (!res.ok) throw new Error("Calendar sync failed. Make sure your Google account is fully linked in Settings.");
    } catch (e: any) {
      console.error("[calendar-sync] Sync failed:", e);
      setSyncError(e.message || "Failed to sync calendar.");
    } finally {
      setSyncLoading(false);
    }
  };

  const handleGmailScan = async () => {
    setGmailLoading(true);
    setGmailError(null);
    try {
      if (!user) throw new Error("User not logged in");
      const idToken = await user.getIdToken();
      const res = await fetch("/api/ai/gmail/scan", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, maxEmails: 20 }),
      });
      if (res.status === 401) {
        setGmailError("Gmail not connected — connect in Settings");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const mapped = data.map((item: any) => ({
        ...item,
        commitmentTitle: item.extractedTitle || item.commitmentTitle || "",
        deadline: item.extractedDeadline || item.deadline || null,
        domain: item.extractedDomain || item.domain || "work",
        effortEstimateHours: item.extractedEffort ?? item.effortEstimateHours ?? 1,
      }));
      setGmailSuggestions(mapped);
    } catch (e: any) {
      setGmailError(e.message ?? "Scan failed. Try again.");
    } finally {
      setGmailLoading(false);
    }
  };

  const mapUrgency = (u: string): any => {
    if (u === "critical") return "immediate";
    if (u === "high" || u === "medium") return "this_week";
    if (u === "low") return "this_month";
    return "no_deadline";
  };

  const mapImportance = (imp: string): any => {
    if (imp === "vip") return "manager";
    if (imp === "recruiter") return "recruiter";
    if (imp === "high") return "professor";
    if (imp === "medium") return "peer";
    return "unknown";
  };

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

  const openRiskModal = async (commitmentId: string) => {
    setSelectedCommitmentId(commitmentId);
    setRiskModalLoading(true);
    setRiskModalError(null);
    try {
      if (!user) throw new Error("User not logged in");
      const idToken = await user.getIdToken();
      const res = await fetch('/api/ai/explain-risk', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({ userId: user.uid, commitmentId })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRiskExplanationData(data);
    } catch (e: any) {
      setRiskModalError(e.message ?? 'Failed to load explanation');
    } finally {
      setRiskModalLoading(false);
    }
  };

  const isLoading = !authChecked || commitmentsLoading;
  const displayName = userProfile?.displayName || user?.displayName || "User";

  const colliding = useMemo(() => {
    return commitments.filter(c => c.hasCollision && !dismissedIds.has(c.id));
  }, [commitments, dismissedIds]);

  const sorted = useMemo(() => {
    return [...commitments].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
  }, [commitments]);

  const isGoogleCalendarConnected = !!(userProfile?.googleCalendarRefreshToken || userProfile?.googleRefreshToken);
  const isGoogleGmailConnected = !!(userProfile?.googleGmailRefreshToken || userProfile?.googleRefreshToken);
  const isEitherIntegrationMissing = !isGoogleCalendarConnected || !isGoogleGmailConnected;

  return (
    <NavShell displayName={displayName}>
      <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8">
        
        {/* Dashboard Header with Sync Button */}
        {!isLoading && (
          <header className="flex items-center justify-between z-10 flex-shrink-0">
            <div>
              <h1 className="text-[26px] font-bold text-on-surface tracking-[-0.01em] leading-none">
                My Dashboard
              </h1>
              <p className="text-[13px] text-on-surface-variant mt-1.5 font-medium">
                Welcome back, {displayName}
              </p>
            </div>

            <PillButton
              variant="outline"
              onClick={handleCalendarSync}
              disabled={syncLoading}
              className="h-10 px-5 text-xs font-bold flex items-center gap-2 shadow-sm"
            >
              {syncLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <RefreshCw className="w-4 h-4 text-primary" />
              )}
              <span>{syncLoading ? "Syncing..." : "Sync Calendar"}</span>
            </PillButton>
          </header>
        )}

        {/* Sync Error Banner */}
        {syncError && (
          <div className="bg-error-container text-on-error-container border border-error/20 rounded-[20px] p-4 flex justify-between items-center font-sans text-sm shadow-sm">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-xs hover:underline font-bold">
              Dismiss
            </button>
          </div>
        )}
        
        {/* GOOGLE_INTEGRATIONS_ALERT */}
        {!isLoading && isEitherIntegrationMissing && (
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-[20px] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-sans text-sm shadow-sm">
            <span>
              Your Google integrations are not connected. Set up integrations to automate scans and schedules.
            </span>
            <button
              onClick={() => router.push("/settings")}
              className="whitespace-nowrap px-4 py-2 bg-amber-500 text-black hover:bg-amber-600 font-bold rounded-full text-xs transition duration-200"
            >
              Link Account
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <SkeletonRow height={120} />
            <SkeletonRow height={120} />
            <SkeletonRow height={120} />
          </div>
        ) : commitments.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-center gap-1">
            <p className="text-on-surface-variant font-sans text-[16px] font-semibold">
              No active commitments yet
            </p>
            <p className="text-on-surface-variant font-sans text-[14px]">
              Tap + to add your first one
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* STRESS_GAUGE_SECTION */}
            {profileLoading ? (
              <div className="flex justify-center p-6 bg-surface-container-low rounded-[24px] border border-outline-variant/30">
                <SkeletonRow height={200} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-surface-container-low rounded-[24px] border border-outline-variant/30">
                <h3 className="text-sm font-semibold text-on-surface-variant font-sans mb-4">Current Stress Level</h3>
                <StressArc score={userProfile?.stats?.stressScore ?? 0} size={200} />
              </div>
            )}

            {/* COLLISION_BANNER_SECTION */}
            {colliding.length > 0 && (
              <CollisionBanner
                commitments={colliding.map(c => ({
                  id: c.id,
                  title: c.title,
                  collisionDetails: c.collisionDetails || null
                }))}
                onRenegotiateClick={(id) => router.push(`/renegotiate/${id}`)}
                onDismiss={(id) => setDismissedIds(prev => {
                  const next = new Set(prev);
                  next.add(id);
                  return next;
                })}
              />
            )}

            {/* GMAIL_SCAN_SECTION */}
            <div className="bg-surface-container-low rounded-[24px] border border-outline-variant/30 p-6 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-[16px] font-bold text-on-surface font-sans flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    <span>Gmail Commitment Scanner</span>
                  </h3>
                  <p className="text-[13px] text-on-surface-variant font-sans mt-1">
                    AI scans your inbox to find deadlines and commitments automatically.
                  </p>
                </div>
                <PillButton
                  variant="outline"
                  onClick={handleGmailScan}
                  disabled={gmailLoading}
                  className="self-start sm:self-center h-10 px-6 text-[14px] font-semibold"
                >
                  {gmailLoading ? "Scanning..." : "Scan Inbox"}
                </PillButton>
              </div>

              {gmailError && (
                <AmberReviewBanner message={gmailError} />
              )}

              {/* Suggestions List */}
              {gmailSuggestions.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-outline-variant/20">
                  <h4 className="text-[12px] font-semibold font-label text-outline tracking-wider uppercase">
                    AI Extracted Suggestions ({gmailSuggestions.filter((_, idx) => !gmailDismissed.has(String(idx))).length})
                  </h4>
                  <div className="grid grid-cols-1 gap-4">
                    <AnimatePresence>
                      {gmailSuggestions.map((suggestion, index) => {
                        const isDismissed = gmailDismissed.has(String(index));
                        if (isDismissed) return null;
                        
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                            className="overflow-hidden"
                          >
                            <GmailSuggestionCard
                              sender={suggestion.sender}
                              subject={suggestion.subject}
                              commitmentTitle={suggestion.commitmentTitle}
                              deadline={suggestion.deadline}
                              urgencyLevel={mapUrgency(suggestion.urgencyLevel)}
                              senderImportance={mapImportance(suggestion.senderImportance)}
                              requiresResponse={suggestion.requiresResponse}
                              onAdd={async () => {
                                try {
                                  const docId = await createCommitment(user!.uid, {
                                    title: suggestion.commitmentTitle,
                                    domain: suggestion.domain ?? 'work',
                                    deadline: suggestion.deadline || new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
                                    effortEstimateHours: suggestion.effortEstimateHours ?? 1,
                                    status: 'active',
                                    completionPercentage: 0,
                                    priority: 'medium',
                                    createdAt: serverTimestamp() as any,
                                  });

                                  // Trigger server-side AI action plan generation asynchronously
                                  user!.getIdToken().then(idToken => {
                                    fetch('/api/ai/generate-action-plan', {
                                      method: 'POST',
                                      headers: { 
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${idToken}`
                                      },
                                      body: JSON.stringify({ userId: user!.uid, commitmentId: docId })
                                    }).catch(err => {
                                      console.error("Failed to generate action plan in background:", err);
                                    });
                                  });

                                  setGmailDismissed(prev => {
                                    const next = new Set(prev);
                                    next.add(String(index));
                                    return next;
                                  });
                                } catch (err) {
                                  console.error("Failed to add commitment from Gmail suggestion:", err);
                                }
                              }}
                              onDismiss={() => {
                                setGmailDismissed(prev => {
                                  const next = new Set(prev);
                                  next.add(String(index));
                                  return next;
                                });
                              }}
                            />
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </div>

            {/* COMMITMENT_CARDS_SECTION */}
            <div className="space-y-4">
              <h3 className="text-[18px] font-bold text-on-surface font-sans">Priority Commitments</h3>
              <div className="flex flex-col gap-4">
                <AnimatePresence>
                  {sorted.map((c, i) => (
                    <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                      <CommitmentCard
                        id={c.id}
                        title={c.title}
                        domain={c.domain}
                        deadline={typeof c.deadline === "string" ? c.deadline : (c.deadline as any)?.toISOString?.() || ""}
                        riskScore={c.riskScore ?? 0}
                        riskTrend={c.riskTrend || "stable"}
                        completionPercentage={c.completionPercentage ?? 0}
                        status={(c.status === "renegotiating" || c.status === "snoozed") ? "active" : c.status as any}
                        priority={c.priority as any || "medium"}
                        onWhyClick={() => openRiskModal(c.id)}
                        onFocusClick={() => router.push(`/focus/${c.id}`)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>

            {/* LIFE_BALANCE_RADAR_SECTION */}
            <LifeBalanceRadar
              commitments={commitments}
              stressScore={userProfile?.stats?.stressScore ?? 0}
            />
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

      <RiskExplanationModal
        open={!!selectedCommitmentId}
        onClose={() => { setSelectedCommitmentId(null); setRiskExplanationData(null); setRiskModalError(null); }}
        commitmentTitle={commitments.find(c => c.id === selectedCommitmentId)?.title ?? ''}
        loading={riskModalLoading}
        explanation={riskModalError || riskExplanationData?.explanation}
        primaryFactor={riskExplanationData?.primaryFactor}
        suggestedAction={riskExplanationData?.suggestedAction}
        requiresUserReview={riskExplanationData?.requiresUserReview}
        reviewReason={riskExplanationData?.reviewReason}
        aiMeta={riskExplanationData?.aiMeta}
      />
    </NavShell>
  );
}
