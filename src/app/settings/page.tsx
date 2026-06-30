"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { Clock, ChevronDown, Calendar, Mail, ArrowLeft, Sparkles, Brain, Percent, RefreshCw, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth, getFcmMessaging, db } from "@/lib/firebase";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PillButton } from "@/components/ui/pill-button";
import { updateUser, getUser } from "@/lib/firestore";
import { getToken, deleteToken } from "firebase/messaging";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { PersonalizationSuggestionCard, Suggestion } from "@/components/personalization-suggestion-card";

export default function SettingsPage() {
  const router = useRouter();
  const { user, setUser, userProfile, subscribeToUserProfile } = useUserStore();

  // Settings State Hooks
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [savedStart, setSavedStart] = useState("09:00");
  const [savedEnd, setSavedEnd] = useState("17:00");
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [gmailConnected, setGmailConnected] = useState(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Saved");
  const [activeTab, setActiveTab] = useState<"general" | "productivity">("general");

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);

  // Suggestions snapshot listener
  useEffect(() => {
    if (!user?.uid) return;
    setSuggestionsLoading(true);
    const q = query(
      collection(db, "users", user.uid, "suggestions"),
      where("status", "==", "pending")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Suggestion[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Suggestion);
      });
      list.sort((a, b) => b.confidence - a.confidence);
      setSuggestions(list);
      setSuggestionsLoading(false);
    }, (err) => {
      console.error("Failed to load suggestions:", err);
      setSuggestionsLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  const handleAcceptSuggestion = async (suggestionId: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/update-coefficients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ suggestionId, status: "accepted" })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setToastMessage("Suggestion accepted! Profile updated.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err: any) {
      console.error("Failed to accept suggestion:", err);
    }
  };

  const handleDismissSuggestion = async (suggestionId: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/user/update-coefficients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ suggestionId, status: "dismissed" })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      setToastMessage("Suggestion dismissed.");
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err: any) {
      console.error("Failed to dismiss suggestion:", err);
    }
  };

  // Load User Preferences On Mount / Auth State
  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return;
      try {
        const profile = await getUser(user.uid);
        const startVal = profile.preferences?.workingHours?.start ?? 9;
        const endVal = profile.preferences?.workingHours?.end ?? 18;
        
        const formatTime = (h: number) => `${String(h).padStart(2, "0")}:00`;
        
        setStartTime(formatTime(startVal));
        setEndTime(formatTime(endVal));
        setSavedStart(formatTime(startVal));
        setSavedEnd(formatTime(endVal));
      } catch (err) {
        console.error("Failed to load user profile in settings:", err);
      }
    };
    loadProfile();
  }, [user]);

  // Live profile listener for settings connections and push status
  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToUserProfile(user.uid);
    return () => {
      if (unsub) unsub();
    };
  }, [user, subscribeToUserProfile]);

  // Sync state variables with the userProfile store value dynamically
  useEffect(() => {
    if (userProfile) {
      setCalendarConnected(!!(userProfile.googleCalendarRefreshToken || userProfile.googleRefreshToken));
      setGmailConnected(!!(userProfile.googleGmailRefreshToken || userProfile.googleRefreshToken));
      setPushEnabled(!!userProfile.fcmToken);
    }
  }, [userProfile]);

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

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      router.push("/");
    } catch (err) {
      console.error("Signout error:", err);
    }
  };

  const handleSaveHours = async () => {
    if (!user?.uid) return;
    try {
      const startNum = parseInt(startTime.split(":")[0], 10);
      const endNum = parseInt(endTime.split(":")[0], 10);
      await updateUser(user.uid, {
        "preferences.workingHours": { start: startNum, end: endNum }
      } as any);
      setSavedStart(startTime);
      setSavedEnd(endTime);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2500);
    } catch (err) {
      console.error("Failed to save working hours:", err);
    }
  };

  const handleToggleNotifications = async (enabled: boolean) => {
    if (!user?.uid) return;
    try {
      const messaging = await getFcmMessaging();
      if (!messaging) {
        console.warn("FCM messaging not supported or permission denied.");
        setPushEnabled(false);
        return;
      }
      if (enabled) {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          console.warn("Notification permission was not granted.");
          setPushEnabled(false);
          return;
        }
        let registration;
        if (typeof window !== "undefined" && "serviceWorker" in navigator) {
          const configParams = new URLSearchParams({
            apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
            authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
            storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
            messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
            appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
          }).toString();

          registration = await navigator.serviceWorker.register(
            `/firebase-messaging-sw.js?${configParams}`
          );
        }

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        });
        await updateUser(user.uid, { fcmToken: token });
        setPushEnabled(true);
      } else {
        await deleteToken(messaging);
        await updateUser(user.uid, { fcmToken: "" });
        setPushEnabled(false);
      }
    } catch (err) {
      console.error("FCM toggle failed:", err);
      setPushEnabled(!enabled);
    }
  };

  const handleConnectCalendar = async () => {
    if (!user?.uid) return;
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/calendar");
      provider.setCustomParameters({ access_type: "offline", prompt: "consent" });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          calendarRefreshToken: credential?.accessToken,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setCalendarConnected(true);
    } catch (err) {
      console.error("Google Calendar connection failed:", err);
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!user?.uid) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          calendarRefreshToken: "",
        }),
      });
      setCalendarConnected(false);
    } catch (err) {
      console.error("Google Calendar disconnect failed:", err);
    }
  };

  const handleConnectGmail = async () => {
    if (!user?.uid) return;
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
      provider.setCustomParameters({ access_type: "offline", prompt: "consent" });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const idToken = await result.user.getIdToken();

      const response = await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          gmailRefreshToken: credential?.accessToken,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setGmailConnected(true);
    } catch (err) {
      console.error("Gmail connection failed:", err);
    }
  };

  const handleDisconnectGmail = async () => {
    if (!user?.uid) return;
    try {
      const idToken = await auth.currentUser?.getIdToken();
      await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: user.uid,
          gmailRefreshToken: "",
        }),
      });
      setGmailConnected(false);
    } catch (err) {
      console.error("Gmail disconnect failed:", err);
    }
  };

  const displayName = userProfile?.displayName || user?.displayName || "User";
  const email = userProfile?.email || user?.email || "user@example.com";
  const avatarUrl = userProfile?.photoURL || user?.photoURL || "";

  const hasHoursChanged = startTime !== savedStart || endTime !== savedEnd;

  return (
    <NavShell displayName={displayName}>
      <div className="max-w-[720px] mx-auto px-6 py-8 flex flex-col gap-8 font-sans pb-24 relative">
        
        {/* Back Link Header */}
        <header className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-primary hover:text-primary-container text-[14px] font-semibold outline-none w-fit focus-visible:underline"
            aria-label="Back to Dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <h1 className="text-[26px] font-bold text-on-surface tracking-[-0.01em] leading-none">
            Settings
          </h1>
        </header>

        {/* PROFILE CARD */}
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-[24px] shadow-card p-5 relative flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-12 h-12 rounded-full border border-outline-variant flex-shrink-0"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-primary text-on-primary font-bold text-[18px] flex items-center justify-center flex-shrink-0 select-none shadow-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="space-y-0.5 min-w-0 pr-20">
            <h3 className="text-[16px] font-bold text-on-surface truncate leading-tight">
              {displayName}
            </h3>
            <p className="text-[14px] text-on-surface-variant truncate leading-none">
              {email}
            </p>
          </div>

          <button
            onClick={handleSignOut}
            className="absolute bottom-5 right-5 text-error text-[14px] font-bold hover:underline outline-none focus-visible:ring-2 focus-visible:ring-error rounded-md px-1"
          >
            Sign Out
          </button>
        </section>

        {/* Tab Navigation */}
        <div className="flex border-b border-outline-variant/30 gap-6 mt-2">
          <button
            onClick={() => setActiveTab("general")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors relative outline-none focus-visible:text-primary ${
              activeTab === "general" ? "text-primary" : "text-outline hover:text-on-surface"
            }`}
          >
            <span>General Settings</span>
            {activeTab === "general" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
          <button
            onClick={() => setActiveTab("productivity")}
            className={`pb-3 text-sm font-bold tracking-wide transition-colors relative outline-none focus-visible:text-primary ${
              activeTab === "productivity" ? "text-primary" : "text-outline hover:text-on-surface"
            }`}
          >
            <span>Productivity Profile</span>
            {activeTab === "productivity" && (
              <motion.div
                layoutId="activeTabUnderline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
              />
            )}
          </button>
        </div>

        {activeTab === "general" ? (
          <>
            {/* APPEARANCE SECTION */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
            Appearance
          </h4>
          
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-card flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <span className="text-[16px] font-semibold text-on-surface">Theme</span>
              <ThemeToggle variant="labeled" />
            </div>
            <p className="text-[12px] font-medium text-on-surface-variant font-label mt-1">
              Light · Dark · System (follows your device settings automatically)
            </p>
          </div>
        </section>

        {/* WORKING HOURS SECTION */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
            Working Hours
          </h4>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-card flex flex-col gap-5">
            {/* Start Time Select */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[16px] font-semibold text-on-surface">Start time</span>
              <div className="relative">
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="appearance-none bg-surface-container text-on-surface-variant font-sans font-bold text-xs rounded-full pl-8 pr-9 py-2 cursor-pointer outline-none border-none focus:ring-2 focus:ring-primary shadow-sm"
                >
                  <option value="07:00">7:00 AM</option>
                  <option value="08:00">8:00 AM</option>
                  <option value="09:00">9:00 AM</option>
                  <option value="10:00">10:00 AM</option>
                  <option value="11:00">11:00 AM</option>
                </select>
                <Clock className="w-3.5 h-3.5 text-outline absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* End Time Select */}
            <div className="flex items-center justify-between gap-4">
              <span className="text-[16px] font-semibold text-on-surface">End time</span>
              <div className="relative">
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="appearance-none bg-surface-container text-on-surface-variant font-sans font-bold text-xs rounded-full pl-8 pr-9 py-2 cursor-pointer outline-none border-none focus:ring-2 focus:ring-primary shadow-sm"
                >
                  <option value="16:00">4:00 PM</option>
                  <option value="17:00">5:00 PM</option>
                  <option value="18:00">6:00 PM</option>
                  <option value="19:00">7:00 PM</option>
                  <option value="20:00">8:00 PM</option>
                  <option value="21:00">9:00 PM</option>
                  <option value="22:00">10:00 PM</option>
                </select>
                <Clock className="w-3.5 h-3.5 text-outline absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <ChevronDown className="w-3.5 h-3.5 text-outline absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Save Hours CTA Button */}
            <div className="pt-2 border-t border-outline-variant/20">
              <PillButton
                variant="outline"
                onClick={handleSaveHours}
                disabled={!hasHoursChanged}
                className={`w-full h-11 text-xs font-semibold ${
                  !hasHoursChanged ? "bg-surface-dim text-on-surface/30 cursor-not-allowed" : ""
                }`}
              >
                Save
              </PillButton>
            </div>
          </div>
        </section>

        {/* NOTIFICATIONS SECTION */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
            Notifications
          </h4>

          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[16px] font-semibold text-on-surface leading-tight block">
                  Enable push notifications
                </span>
                <span className="text-[13px] text-on-surface-variant font-medium leading-relaxed block">
                  Get check-in reminders and collision alerts
                </span>
              </div>

              {/* Switch */}
              <button
                onClick={() => handleToggleNotifications(!pushEnabled)}
                className={`w-11 h-6 rounded-full relative transition-colors duration-200 outline-none flex items-center flex-shrink-0 cursor-pointer
                  ${pushEnabled ? "bg-primary" : "bg-surface-dim"}`}
                aria-label="Toggle Push Notifications"
              >
                <motion.span
                  layout
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  className="absolute left-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  style={{ left: pushEnabled ? "calc(100% - 20px)" : "4px" }}
                />
              </button>
            </div>
          </div>
        </section>

        {/* CONNECTED ACCOUNTS SECTION */}
        <section className="space-y-3">
          <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
            Connected Accounts
          </h4>

          <div className="flex flex-col gap-3">
            {/* Google Calendar Connection Card */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-5 py-[14px] shadow-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-[16px] font-semibold text-on-surface font-sans">
                  Google Calendar
                </span>
              </div>

              <div className="flex items-center gap-3">
                {calendarConnected ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-950/20 shadow-sm select-none">
                      Connected
                    </span>
                    <button
                      onClick={handleDisconnectCalendar}
                      className="text-[13px] font-bold text-outline hover:text-on-surface transition-colors outline-none focus-visible:underline"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-950/20 shadow-sm select-none">
                      Disconnected
                    </span>
                    <PillButton
                      variant="primary"
                      onClick={handleConnectCalendar}
                      className="h-8 text-xs font-semibold px-4"
                    >
                      Connect
                    </PillButton>
                  </>
                )}
              </div>
            </div>

            {/* Gmail Connection Card */}
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-5 py-[14px] shadow-card flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-primary flex-shrink-0" />
                <span className="text-[16px] font-semibold text-on-surface font-sans">
                  Gmail Scanning
                </span>
              </div>

              <div className="flex items-center gap-3">
                {gmailConnected ? (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-emerald-600 bg-emerald-500/10 dark:text-emerald-400 dark:bg-emerald-950/20 shadow-sm select-none">
                      Connected
                    </span>
                    <button
                      onClick={handleDisconnectGmail}
                      className="text-[13px] font-bold text-outline hover:text-on-surface transition-colors outline-none focus-visible:underline"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-amber-600 bg-amber-500/10 dark:text-amber-400 dark:bg-amber-950/20 shadow-sm select-none">
                      Disconnected
                    </span>
                    <PillButton
                      variant="primary"
                      onClick={handleConnectGmail}
                      className="h-8 text-xs font-semibold px-4"
                    >
                      Connect
                    </PillButton>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
          </>
        ) : (
          /* PRODUCTIVITY PROFILE TAB */
          <div className="flex flex-col gap-6">
            {/* Productivity Profile Metrics Card */}
            <section className="space-y-3">
              <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
                Productivity Metrics
              </h4>
              <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 shadow-card grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Multiplier Stat */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Percent className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[12px] font-bold text-outline uppercase tracking-wider block">
                      Underestimation Factor
                    </span>
                    <span className="text-[20px] font-black text-on-surface leading-none block">
                      {(userProfile?.learningCoefficients?.underestimationFactor ?? 1.0).toFixed(2)}x
                    </span>
                    <span className="text-[12px] text-on-surface-variant font-medium leading-relaxed block">
                      Adjusts plan effort requirements based on past performance.
                    </span>
                  </div>
                </div>

                {/* Attention Span Stat */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[12px] font-bold text-outline uppercase tracking-wider block">
                      Attention Span
                    </span>
                    <span className="text-[20px] font-black text-on-surface leading-none block">
                      {userProfile?.learningCoefficients?.averageAttentionSpanMinutes ?? 25} min
                    </span>
                    <span className="text-[12px] text-on-surface-variant font-medium leading-relaxed block">
                      Optimal duration of active work before scheduling breaks.
                    </span>
                  </div>
                </div>

                {/* Preferred Work Hours Stat */}
                {userProfile?.learningCoefficients?.preferredWorkHours && userProfile.learningCoefficients.preferredWorkHours.length > 0 && (
                  <div className="flex items-start gap-3 md:col-span-2 border-t border-outline-variant/20 pt-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-5 h-5" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[12px] font-bold text-outline uppercase tracking-wider block">
                        Preferred Focus Hours
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {userProfile.learningCoefficients.preferredWorkHours.map((h, i) => {
                          const period = h >= 12 ? "PM" : "AM";
                          const displayH = h % 12 === 0 ? 12 : h % 12;
                          return (
                            <span 
                              key={i}
                              className="px-2.5 py-1 bg-surface-container text-on-surface text-[11px] font-bold rounded-full border border-outline-variant/30 font-label shadow-sm"
                            >
                              {displayH}:00 {period}
                            </span>
                          );
                        })}
                      </div>
                      <span className="text-[12px] text-on-surface-variant font-medium leading-relaxed block">
                        Identified peak cognitive periods for demanding tasks.
                      </span>
                    </div>
                  </div>
                )}

                {/* Domain-specific Multipliers */}
                {userProfile?.learningCoefficients?.domainEffortMultipliers && Object.keys(userProfile.learningCoefficients.domainEffortMultipliers).length > 0 && (
                  <div className="flex items-start gap-3 md:col-span-2 border-t border-outline-variant/20 pt-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="space-y-2 w-full">
                      <span className="text-[12px] font-bold text-outline uppercase tracking-wider block">
                        Domain Multipliers
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full">
                        {Object.entries(userProfile.learningCoefficients.domainEffortMultipliers).map(([domain, val], idx) => (
                          <div 
                            key={idx}
                            className="bg-surface-container border border-outline-variant/30 rounded-xl p-3 flex flex-col gap-1 shadow-sm"
                          >
                            <span className="text-[10px] font-extrabold uppercase tracking-wide text-outline text-left">
                              {domain}
                            </span>
                            <span className="text-lg font-black text-on-surface leading-none text-left">
                              {Number(val).toFixed(2)}x
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </section>

            {/* Recommendations / Suggestions Section */}
            <section className="space-y-3">
              <h4 className="text-[12px] font-extrabold font-label text-outline tracking-wider uppercase pl-1">
                AI Calibration Recommendations
              </h4>

              {suggestionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : suggestions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl text-center gap-3">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                    <Brain className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-on-surface">Your profile is fully calibrated</h4>
                    <p className="text-xs text-on-surface-variant max-w-[320px]">
                      No new suggestions available. As you complete more focus sessions, FinishLine will discover patterns.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <AnimatePresence mode="popLayout">
                    {suggestions.map((s) => (
                      <PersonalizationSuggestionCard
                        key={s.id}
                        suggestion={s}
                        onAccept={handleAcceptSuggestion}
                        onDismiss={handleDismissSuggestion}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ABOUT / FOOTER SECTION */}
        <footer className="flex flex-col gap-1 text-center py-4">
          <span className="text-[12px] font-semibold font-label text-outline uppercase tracking-wider">
            Version 1.0.0
          </span>
          <span className="text-[12px] font-semibold font-label text-outline uppercase tracking-wider">
            Architecture frozen: June 25, 2026
          </span>
        </footer>

        {/* Floating Toast Notification */}
        <AnimatePresence>
          {showToast && (
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-tertiary text-on-tertiary px-6 py-2.5 rounded-full shadow-lg text-sm font-semibold font-label tracking-wide flex items-center justify-center gap-1.5"
            >
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </NavShell>
  );
}
