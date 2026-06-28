"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Clock, ChevronDown, Calendar, Mail, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { PillButton } from "@/components/ui/pill-button";

export default function SettingsPage() {
  const router = useRouter();
  const { user, userProfile, logout } = useUserStore();

  // Settings State Hooks
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [savedStart, setSavedStart] = useState("09:00");
  const [savedEnd, setSavedEnd] = useState("17:00");
  
  const [pushEnabled, setPushEnabled] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);

  const [showToast, setShowToast] = useState(false);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Signout error:", err);
    }
  };

  const handleSaveHours = () => {
    setSavedStart(startTime);
    setSavedEnd(endTime);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
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

              {/* Framer Motion premium Switch */}
              <button
                onClick={() => {
                  setPushEnabled(!pushEnabled);
                  // INTENDED FIRESTORE/FCM USECASE:
                  // 1. Check browser serviceWorker support.
                  // 2. Call Firebase Messaging client SDK `getToken(messaging, { vapidKey })`.
                  // 3. Perform a write query to the Firestore backend saving this push device token:
                  //    await updateDoc(doc(db, "users", userId), { fcmDeviceToken: token, pushNotificationsEnabled: true });
                }}
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
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-tertiary bg-tertiary/10 shadow-sm select-none">
                      Connected
                    </span>
                    <button
                      onClick={() => setCalendarConnected(false)}
                      className="text-[13px] font-bold text-outline hover:text-on-surface transition-colors outline-none focus-visible:underline"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-error bg-error/10 shadow-sm select-none">
                      Not connected
                    </span>
                    <PillButton
                      variant="primary"
                      onClick={() => setCalendarConnected(true)}
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
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-tertiary bg-tertiary/10 shadow-sm select-none">
                      Connected
                    </span>
                    <button
                      onClick={() => setGmailConnected(false)}
                      className="text-[13px] font-bold text-outline hover:text-on-surface transition-colors outline-none focus-visible:underline"
                    >
                      Disconnect
                    </button>
                  </>
                ) : (
                  <>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold font-label text-error bg-error/10 shadow-sm select-none">
                      Not connected
                    </span>
                    <PillButton
                      variant="primary"
                      onClick={() => setGmailConnected(true)}
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
              <span>Saved</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </NavShell>
  );
}
