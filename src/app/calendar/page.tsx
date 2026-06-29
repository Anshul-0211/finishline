"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Loader2, RefreshCw } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCommitmentsStore } from "@/lib/stores/useCommitmentsStore";
import { NavShell } from "@/components/nav-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { SkeletonRow } from "@/components/ui/skeleton-row";

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO format string
  end: string;   // ISO format string
  isAllDay?: boolean;
  colorId?: string;
  location?: string;
  recurringEventId?: string;
  organizerEmail?: string;
  selfResponseStatus?: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const { user, setUser, userProfile, subscribeToUserProfile } = useUserStore();
  const { commitments, subscribeToCommitments } = useCommitmentsStore();

  // Helper: Get start of current week's Monday (Mon-Sun)
  const getMonday = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // State Management
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getMonday(new Date()));
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);

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
      
      // Re-fetch calendar events for current view
      await fetchCalendarEvents(currentWeekStart);
    } catch (e: any) {
      console.error("[calendar-sync] Sync failed:", e);
      setSyncError(e.message || "Failed to sync calendar.");
    } finally {
      setSyncLoading(false);
    }
  };

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

  // Firestore User Profile Subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToUserProfile(user.uid);
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, subscribeToUserProfile]);

  // Update calendar connected state based on Firestore tokens
  useEffect(() => {
    if (userProfile) {
      const hasCalendarToken = !!(userProfile.googleCalendarRefreshToken || userProfile.googleRefreshToken);
      setCalendarConnected(hasCalendarToken);
    }
  }, [userProfile]);

  // Firestore Commitments Subscription
  useEffect(() => {
    if (!user) return;
    const unsubscribe = subscribeToCommitments(user.uid);
    return () => unsubscribe();
  }, [user, subscribeToCommitments]);

  // Fetch Calendar Events
  const fetchCalendarEvents = async (weekStart: Date) => {
    if (!user?.uid) return;
    setCalendarLoading(true);
    setCalendarError(null);
    const timeMin = weekStart.toISOString();
    const timeMax = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      console.log(`[Frontend] Fetching Google Calendar events from ${timeMin} to ${timeMax}...`);
      const res = await fetch(
        `/api/calendar/events?userId=${user.uid}&timeMin=${timeMin}&timeMax=${timeMax}`
      );
      if (res.status === 401) {
        console.warn("[Frontend] Google Calendar not connected (401 response).");
        setCalendarConnected(false);
        setCalendarEvents([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CalendarEvent[] = await res.json();
      console.log("[Frontend] Calendar events returned:", data);
      setCalendarEvents(data.filter((e) => !e.isAllDay)); // skip all-day events for timeline
      setCalendarConnected(true);
    } catch (e: any) {
      console.error("[Frontend] fetchCalendarEvents failed:", e);
      setCalendarError(e.message ?? "Failed to load calendar");
    } finally {
      setCalendarLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;
    fetchCalendarEvents(currentWeekStart);
  }, [user?.uid, currentWeekStart]);

  // Track current timeline marker position
  useEffect(() => {
    const updateTimeMarker = () => {
      const now = new Date();
      const hour = now.getHours();
      const mins = now.getMinutes();

      if (hour >= 8 && hour <= 22) {
        const elapsedMins = (hour - 8) * 60 + mins;
        const pos = (elapsedMins / 60) * 60; // 60px per hour
        setCurrentTimePos(pos);
      } else {
        setCurrentTimePos(null);
      }
    };

    updateTimeMarker();
    const interval = setInterval(updateTimeMarker, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format week range text
  const formatWeekRange = (start: Date) => {
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startStr = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${startStr} – ${endStr}`;
  };

  // Generate 7 days for columns
  const getWeekDates = (start: Date) => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeekStart);

  // Dynamic Column Sizing Helpers: Today and Tomorrow columns are 1.3fr, others are 0.88fr
  const getColumnWidths = (dates: Date[]) => {
    const todayStr = new Date().toDateString();
    const tomorrowStr = new Date(Date.now() + 86400000).toDateString();

    return dates
      .map((d) => {
        const dStr = d.toDateString();
        if (dStr === todayStr) return "1.3fr";
        if (dStr === tomorrowStr) return "1.3fr";
        return "0.88fr";
      })
      .join(" ");
  };

  const getColumnLayout = (colIdx: number, dates: Date[]) => {
    const widths = dates.map((d) => {
      const dStr = d.toDateString();
      if (dStr === new Date().toDateString()) return 1.3;
      if (dStr === new Date(Date.now() + 86400000).toDateString()) return 1.3;
      return 0.88;
    });

    const totalUnits = widths.reduce((sum, w) => sum + w, 0);
    let leftUnits = 0;
    for (let i = 0; i < colIdx; i++) {
      leftUnits += widths[i];
    }

    const leftPercent = (leftUnits / totalUnits) * 100;
    const widthPercent = (widths[colIdx] / totalUnits) * 100;

    return { leftPercent, widthPercent };
  };

  // Navigate weeks
  const handlePrevWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getTime() - 7 * 24 * 60 * 60 * 1000));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart((prev) => new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000));
  };

  const handleGoToday = () => {
    setCurrentWeekStart(getMonday(new Date()));
  };

  const toDateObject = (val: any): Date => {
    if (!val) return new Date();
    if (typeof val.toDate === "function") return val.toDate();
    return new Date(val);
  };

  // Assemble FinishLine Blocks (with deadline fallback if no scheduled blocks exist)
  const finishlineBlocks = commitments
    .flatMap((c) => {
      if (c.scheduledBlocks && c.scheduledBlocks.length > 0) {
        return c.scheduledBlocks.map((block) => {
          const startVal = block.startTime || block.start;
          const endVal = block.endTime || block.end;
          return {
            commitmentTitle: c.title,
            start: toDateObject(startVal),
            end: toDateObject(endVal),
            domain: c.domain,
            commitmentId: c.id,
            isPlaceholder: false,
          };
        });
      } else if (c.deadline) {
        // Fallback: If no scheduled blocks, place a 1-hour placeholder block on the day of the deadline at 9 AM
        const deadlineDate = toDateObject(c.deadline);
        const placeholderStart = new Date(deadlineDate);
        placeholderStart.setHours(9, 0, 0, 0);
        const placeholderEnd = new Date(deadlineDate);
        placeholderEnd.setHours(10, 0, 0, 0);

        return [
          {
            commitmentTitle: `${c.title} (Deadline)`,
            start: placeholderStart,
            end: placeholderEnd,
            domain: c.domain,
            commitmentId: c.id,
            isPlaceholder: true,
          },
        ];
      }
      return [];
    })
    .filter((block) => {
      const blockTime = block.start.getTime();
      const weekStartTime = currentWeekStart.getTime();
      const weekEndTime = weekStartTime + 7 * 24 * 60 * 60 * 1000;
      const isMatch = blockTime >= weekStartTime && blockTime < weekEndTime;
      return isMatch;
    });

  // Debug logger for visible blocks tracking
  useEffect(() => {
    console.log("[Calendar Page] Rendered with currentWeekStart:", currentWeekStart.toISOString());
    console.log("[Calendar Page] Active commitments list count:", commitments.length);
    commitments.forEach(c => {
      if (c.scheduledBlocks && c.scheduledBlocks.length > 0) {
        console.log(`[Calendar Page] Commitment "${c.title}" blocks in DB:`, c.scheduledBlocks);
      }
    });
    console.log("[Calendar Page] Filtered visible scheduled blocks count for this week:", finishlineBlocks.length);
  }, [commitments, finishlineBlocks, currentWeekStart]);

  // Calculate upcoming commitments with block counts or deadline labels
  const upcomingCommitments = commitments
    .map((c) => {
      const hasBlocks = c.scheduledBlocks && c.scheduledBlocks.length > 0;

      if (hasBlocks) {
        const weekBlocks = (c.scheduledBlocks ?? []).filter((block) => {
          const start = block.startTime || block.start;
          if (!start) return false;
          const blockStart = toDateObject(start);
          return (
            blockStart >= currentWeekStart &&
            blockStart < new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
          );
        });

        if (weekBlocks.length === 0) return null;

        const earliestStart = Math.min(
          ...weekBlocks.map((b) => toDateObject(b.startTime || b.start).getTime())
        );

        return {
          commitment: c,
          blocksCount: weekBlocks.length,
          earliestStart,
          label: `${weekBlocks.length} block${weekBlocks.length > 1 ? "s" : ""} scheduled this week`,
        };
      } else if (c.deadline) {
        const deadlineDate = toDateObject(c.deadline);
        const isThisWeek =
          deadlineDate >= currentWeekStart &&
          deadlineDate < new Date(currentWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

        if (!isThisWeek) return null;

        return {
          commitment: c,
          blocksCount: 0,
          earliestStart: deadlineDate.getTime(),
          label: `Due ${deadlineDate.toLocaleDateString("en-US", { weekday: "short" })} (No blocks scheduled)`,
        };
      }
      return null;
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.earliestStart - b.earliestStart);

  // Position Helpers
  const TIMELINE_START_HOUR = 8; // 8 AM
  const HOUR_HEIGHT_PX = 60;

  const getTopPx = (date: Date) => {
    const hours = date.getHours() + date.getMinutes() / 60;
    return Math.max(0, (hours - TIMELINE_START_HOUR) * HOUR_HEIGHT_PX);
  };

  const getHeightPx = (start: Date, end: Date) => {
    const durationMinutes = (end.getTime() - start.getTime()) / 60000;
    return Math.max(24, (durationMinutes / 60) * HOUR_HEIGHT_PX);
  };

  const getDayIndex = (date: Date, dates: Date[]) => {
    const dayStr = date.toDateString();
    return dates.findIndex((d) => d.toDateString() === dayStr);
  };

  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM (22)

  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <NavShell displayName={displayName}>
      <div className="w-full lg:w-3/4 mx-auto px-6 py-6 flex flex-col gap-6 font-sans">
        {/* Dedicated Google Calendar Connect Box */}
        {!calendarConnected && (
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-[24px] p-6 text-center space-y-4 flex flex-col items-center justify-center min-h-[180px] shadow-sm font-sans">
            <Calendar className="w-8 h-8 text-amber-500" />
            <div className="space-y-1">
              <h3 className="text-base font-bold text-on-surface">Google Calendar not connected</h3>
              <p className="text-sm text-on-surface-variant max-w-sm mx-auto">
                Connect your Google Calendar to view your schedule and sync commitments.
              </p>
            </div>
            <button
              onClick={() => router.push("/settings")}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-black font-bold rounded-full text-xs transition duration-200"
            >
              Configure Google integration in Settings
            </button>
          </div>
        )}

        {/* WEEK HEADER ROW */}
        <div className="flex items-center justify-between gap-3 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Previous week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextWeek}
              className="w-8 h-8 rounded-full bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Next week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <h3 className="text-[16px] font-bold text-on-surface tracking-tight">
            {formatWeekRange(currentWeekStart)}
          </h3>

          <div className="flex items-center gap-3">
            <button
              onClick={handleGoToday}
              className="text-[14px] font-semibold text-primary hover:text-primary-container outline-none focus-visible:underline"
            >
              Today
            </button>
            
            <button
              onClick={handleCalendarSync}
              disabled={syncLoading}
              className="h-8 px-3 border border-outline-variant rounded-full text-xs font-bold flex items-center gap-1.5 hover:bg-surface-container transition-colors disabled:opacity-50"
              title="Sync Calendar"
            >
              {syncLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-primary" />
              )}
              <span>{syncLoading ? "Syncing..." : "Sync"}</span>
            </button>
          </div>
        </div>

        {/* Sync Error Banner */}
        {syncError && (
          <div className="bg-error-container text-on-error-container border border-error/20 rounded-[20px] p-4 flex justify-between items-center font-sans text-sm shadow-sm flex-shrink-0">
            <span>{syncError}</span>
            <button onClick={() => setSyncError(null)} className="text-xs hover:underline font-bold">
              Dismiss
            </button>
          </div>
        )}

        {/* DAY COLUMN HEADERS WITH DYNAMIC WIDTHS */}
        <div
          className="grid border-b border-outline-variant pb-2"
          style={{ gridTemplateColumns: `40px ${getColumnWidths(weekDates)}` }}
        >
          <div /> {/* spacing for time column */}
          {weekDates.map((date, idx) => {
            const isToday = date.toDateString() === new Date().toDateString();
            const dayStr = date.toLocaleDateString("en-US", { weekday: "short" });
            const numStr = date.getDate().toString();

            return (
              <div key={idx} className="flex flex-col items-center gap-1.5">
                <span
                  className={`text-[12px] font-semibold font-label ${
                    isToday ? "text-primary font-bold" : "text-outline"
                  }`}
                >
                  {dayStr}
                </span>
                <div
                  className={`w-7 h-7 flex items-center justify-center text-[15px] font-bold font-sans rounded-full select-none
                    ${isToday ? "bg-primary text-on-primary shadow-sm" : "text-on-surface"}`}
                >
                  {numStr}
                </div>
              </div>
            );
          })}
        </div>

        {/* TIMELINE VIEW GRID */}
        <div className="relative border border-outline-variant/30 rounded-xl bg-surface-container-lowest/30 overflow-hidden flex flex-col flex-1 min-h-[450px]">
          <AnimatePresence mode="wait">
            {calendarLoading ? (
              /* Loading screen skeletons */
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 p-4 flex-1"
              >
                <div className="flex items-center justify-center gap-2 py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-xs font-bold text-on-surface-variant font-label">
                    Syncing schedules...
                  </span>
                </div>
                <SkeletonRow height={60} />
                <SkeletonRow height={60} />
                <SkeletonRow height={60} />
                <SkeletonRow height={60} />
              </motion.div>
            ) : (
              /* Timeline Scheduler grid */
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="relative overflow-y-auto flex-1 h-[900px] select-none [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {/* Current Time red indicator line */}
                {currentTimePos !== null && (
                  <div
                    className="absolute left-10 right-0 h-[2px] bg-error z-20 pointer-events-none"
                    style={{ top: `${currentTimePos}px` }}
                  >
                    <div className="absolute -left-1.5 -top-1 w-2.5 h-2.5 rounded-full bg-error" />
                  </div>
                )}

                {/* Grid hourly rows */}
                {hours.map((hour) => {
                  const ampm = hour >= 12 ? (hour === 12 ? "12 PM" : `${hour - 12} PM`) : `${hour} AM`;

                  return (
                    <div
                      key={hour}
                      className="relative h-[60px] grid"
                      style={{ gridTemplateColumns: "40px 1fr" }}
                    >
                      {/* Time label column */}
                      <span className="text-[11px] font-bold font-label text-outline text-right pr-2 pt-1 border-r border-outline-variant/20">
                        {ampm}
                      </span>
                      {/* Horizontal dividers per hour */}
                      <div className="border-b border-outline-variant/10 relative">
                        {/* Dynamic Column dividers */}
                        <div
                          className="absolute inset-0 h-full pointer-events-none grid"
                          style={{ gridTemplateColumns: getColumnWidths(weekDates) }}
                        >
                          {Array.from({ length: 7 }).map((_, cIdx) => (
                            <div
                              key={cIdx}
                              className="border-r border-outline-variant/10 h-full last:border-r-0"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Google Calendar events */}
                {calendarConnected &&
                  calendarEvents.map((evt) => {
                    const evtDate = new Date(evt.start);
                    const colIdx = getDayIndex(evtDate, weekDates);
                    if (colIdx === -1) return null;

                    const top = getTopPx(evtDate);
                    const height = getHeightPx(evtDate, new Date(evt.end));
                    const { leftPercent, widthPercent } = getColumnLayout(colIdx, weekDates);

                    return (
                      <div
                        key={`google-${evt.id}`}
                        className="absolute border-l-[3px] p-2 text-[11px] font-bold font-sans rounded-md leading-tight text-left shadow-sm z-10 bg-tertiary/15 border-tertiary text-tertiary hover:bg-tertiary/20 transition duration-200 outline-none overflow-hidden"
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(40px + (100% - 40px) * ${leftPercent / 100} + 3px)`,
                          width: `calc((100% - 40px) * ${widthPercent / 100} - 5px)`,
                        }}
                        title={evt.title}
                      >
                        <p className="line-clamp-3 overflow-hidden text-ellipsis whitespace-normal break-words">
                          {evt.title}
                        </p>
                      </div>
                    );
                  })}

                {/* FinishLine blocks */}
                {finishlineBlocks.map((block, idx) => {
                  const colIdx = getDayIndex(block.start, weekDates);
                  if (colIdx === -1) return null;

                  const top = getTopPx(block.start);
                  const height = getHeightPx(block.start, block.end);
                  const { leftPercent, widthPercent } = getColumnLayout(colIdx, weekDates);

                  return (
                    <button
                      key={`fl-${block.commitmentId}-${idx}`}
                      onClick={() => router.push(`/commitments`)}
                      className={`absolute border-l-[3px] p-2 text-[11px] font-sans rounded-md leading-tight text-left shadow-sm z-10 transition duration-200 outline-none overflow-hidden
                        ${block.isPlaceholder
                          ? "bg-primary/5 border-dashed border-primary text-primary/80 font-medium hover:bg-primary/10"
                          : "bg-primary/15 border-primary text-primary font-extrabold hover:bg-primary/20"
                        }`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(40px + (100% - 40px) * ${leftPercent / 100} + 3px)`,
                        width: `calc((100% - 40px) * ${widthPercent / 100} - 5px)`,
                      }}
                      title={block.isPlaceholder ? `Deadline placeholder: ${block.commitmentTitle}` : `View commitment: ${block.commitmentTitle}`}
                    >
                      <p className="line-clamp-3 overflow-hidden text-ellipsis whitespace-normal break-words">
                        {block.commitmentTitle}
                      </p>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* UPCOMING TASK PANEL */}
        <section className="space-y-3 mt-2">
          <h4 className="text-[12px] font-extrabold font-label text-outline uppercase tracking-widest pl-1">
            This Week
          </h4>
          <div className="flex flex-col gap-2">
            {upcomingCommitments.length === 0 ? (
              <div className="text-center py-6 text-on-surface-variant font-label text-xs">
                No blocks scheduled for this week.
              </div>
            ) : (
              upcomingCommitments.map(({ commitment: task, label }) => (
                <div
                  key={task.id}
                  onClick={() => router.push("/commitments")}
                  className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-card hover:border-outline-variant/60 transition-all duration-200 cursor-pointer"
                >
                  <div className="space-y-0.5">
                    <h5 className="text-[14px] font-bold text-on-surface font-sans">
                      {task.title}
                    </h5>
                    <p className="text-[12px] font-medium text-on-surface-variant font-label">
                      {label}
                    </p>
                  </div>
                  <RiskBadge score={task.riskScore || 0} />
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </NavShell>
  );
}
