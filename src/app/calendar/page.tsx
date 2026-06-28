"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar, Loader2 } from "lucide-react";
import { onAuthStateChanged } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";
import { NavShell } from "@/components/nav-shell";
import { RiskBadge } from "@/components/ui/risk-badge";
import { SkeletonRow } from "@/components/ui/skeleton-row";

interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO format string
  end: string;
  type: "finishline" | "google";
  priority: "critical" | "high" | "medium" | "low";
}

interface FreeSlot {
  id: string;
  start: string;
  end: string;
}

export default function CalendarPage() {
  const router = useRouter();
  const { user, userProfile } = useUserStore();

  // Helper: Get start of current week's Monday
  const getStartOfWeek = (d: Date) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // State Management
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTimePos, setCurrentTimePos] = useState<number | null>(null);

  // Auth Guard
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/");
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

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
    setLoading(true);
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
    setTimeout(() => setLoading(false), 800);
  };

  const handleNextWeek = () => {
    setLoading(true);
    setCurrentWeekStart((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
    setTimeout(() => setLoading(false), 800);
  };

  const handleGoToday = () => {
    setLoading(true);
    setCurrentWeekStart(getStartOfWeek(new Date()));
    setTimeout(() => setLoading(false), 800);
  };

  // Mock schedule database with specific priorities
  const mockEvents: CalendarEvent[] = [
    {
      id: "evt-1",
      title: "OS Assignment Prep Block",
      start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -5 : 2))).toISOString().split("T")[0] + "T09:00:00", // Tuesday 9am
      end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -5 : 2))).toISOString().split("T")[0] + "T12:00:00",
      type: "finishline",
      priority: "critical",
    },
    {
      id: "evt-2",
      title: "Sarah's Birthday Celebration",
      start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -4 : 3))).toISOString().split("T")[0] + "T18:00:00", // Wednesday 6pm
      end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -4 : 3))).toISOString().split("T")[0] + "T21:00:00",
      type: "google",
      priority: "medium",
    },
    {
      id: "evt-3",
      title: "Mock Interview Recruiter session",
      start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -3 : 4))).toISOString().split("T")[0] + "T14:00:00", // Thursday 2pm
      end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -3 : 4))).toISOString().split("T")[0] + "T16:00:00",
      type: "finishline",
      priority: "high",
    },
  ];

  const mockFreeSlots: FreeSlot[] = [
    {
      id: "free-1",
      start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -6 : 1))).toISOString().split("T")[0] + "T10:00:00", // Monday 10am
      end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -6 : 1))).toISOString().split("T")[0] + "T12:00:00",
    },
    {
      id: "free-2",
      start: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -3 : 4))).toISOString().split("T")[0] + "T10:00:00", // Thursday 10am
      end: new Date(new Date().setDate(new Date().getDate() - new Date().getDay() + (new Date().getDay() === 0 ? -3 : 4))).toISOString().split("T")[0] + "T12:00:00",
    }
  ];

  const mockUpcomingTasks = [
    { title: "OS Assignment Prep Block", blocks: 3, riskScore: 82 },
    { title: "Mock Interview Recruiter session", blocks: 2, riskScore: 45 }
  ];

  // Helper to map event coordinates
  const getEventCoords = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    
    const top = Math.max(0, (startHour - 8) * 60);
    const height = Math.max(24, (endHour - startHour) * 60);
    return { top, height };
  };

  const getEventColIndex = (eventDateStr: string, dates: Date[]) => {
    const eventDate = new Date(eventDateStr);
    const eventDayStr = eventDate.toDateString();
    return dates.findIndex((d) => d.toDateString() === eventDayStr);
  };

  const hours = Array.from({ length: 15 }, (_, i) => i + 8); // 8 AM to 10 PM (22)

  const displayName = userProfile?.displayName || user?.displayName || "User";

  return (
    <NavShell displayName={displayName}>
      <div className="max-w-[720px] mx-auto px-6 py-6 flex flex-col gap-6 font-sans">
        
        {/* Toggle Panel for Visual Testing */}
        <div className="bg-surface-container-low px-4 py-2.5 rounded-xl border border-outline-variant flex items-center justify-between text-xs text-on-surface-variant font-label">
          <span>Test Settings:</span>
          <label className="flex items-center gap-2 cursor-pointer font-semibold select-none">
            <input
              type="checkbox"
              checked={calendarConnected}
              onChange={(e) => setCalendarConnected(e.target.checked)}
              className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            Connect Google Calendar
          </label>
        </div>

        {/* Calendar disconnected warning banner */}
        {!calendarConnected && (
          <div className="bg-secondary-container/20 border-l-4 border-secondary px-4 py-3 rounded-r-lg flex items-center gap-3 shadow-sm">
            <Calendar className="w-5 h-5 text-secondary flex-shrink-0" />
            <p className="text-secondary text-[14px] font-semibold leading-normal">
              Showing FinishLine blocks only. Tap "Connect Google Calendar" above to sync external events.
            </p>
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

          <button
            onClick={handleGoToday}
            className="text-[14px] font-semibold text-primary hover:text-primary-container outline-none focus-visible:underline"
          >
            Today
          </button>
        </div>

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
                <span className={`text-[12px] font-semibold font-label ${isToday ? "text-primary font-bold" : "text-outline"}`}>
                  {dayStr}
                </span>
                <div
                  className={`w-7 h-7 flex items-center justify-center text-[15px] font-bold font-sans rounded-full select-none
                    ${
                      isToday
                        ? "bg-primary text-on-primary shadow-sm"
                        : "text-on-surface"
                    }`}
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
            {loading ? (
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
                  <span className="text-xs font-bold text-on-surface-variant font-label">Syncing schedules...</span>
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
                {hours.map((hour, idx) => {
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
                            <div key={cIdx} className="border-r border-outline-variant/10 h-full last:border-r-0" />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Absolutely positioned mock events */}
                {mockEvents
                  .filter((evt) => calendarConnected || evt.type === "finishline")
                  .map((evt) => {
                    const colIdx = getEventColIndex(evt.start, weekDates);
                    if (colIdx === -1) return null;

                    const { top, height } = getEventCoords(evt.start, evt.end);
                    const { leftPercent, widthPercent } = getColumnLayout(colIdx, weekDates);

                    // Saturated container-based color schemes with high contrast borders and texts
                    let colorStyles = "";
                    if (evt.type === "google") {
                      colorStyles = "bg-tertiary-container border-tertiary text-on-tertiary-container hover:bg-tertiary-container/90";
                    } else if (evt.priority === "critical" || evt.priority === "high") {
                      colorStyles = "bg-error-container border-error text-on-error-container hover:bg-error-container/90";
                    } else if (evt.priority === "medium") {
                      colorStyles = "bg-secondary-container border-secondary text-on-secondary-container hover:bg-secondary-container/90";
                    } else {
                      colorStyles = "bg-primary-container border-primary text-on-primary-container hover:bg-primary-container/90";
                    }

                    return (
                      <button
                        key={evt.id}
                        onClick={() => router.push("/commitments")}
                        className={`absolute border-l-[3px] p-2 text-[11px] font-bold font-sans rounded-md leading-tight text-left shadow-sm z-10 hover:shadow transition duration-200 outline-none focus-visible:ring-2 focus-visible:ring-primary ${colorStyles}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          left: `calc(40px + (100% - 40px) * ${leftPercent / 100} + 3px)`,
                          width: `calc((100% - 40px) * ${widthPercent / 100} - 5px)`,
                        }}
                        title={`Click to view commitments: ${evt.title}`}
                      >
                        {/* Text wraps and clamps to 3 lines */}
                        <p className="line-clamp-3 overflow-hidden text-ellipsis whitespace-normal break-words">
                          {evt.title}
                        </p>
                      </button>
                    );
                  })}

                {/* Absolutely positioned free slot zones */}
                {mockFreeSlots.map((slot) => {
                  const colIdx = getEventColIndex(slot.start, weekDates);
                  if (colIdx === -1) return null;

                  const { top, height } = getEventCoords(slot.start, slot.end);
                  const { leftPercent, widthPercent } = getColumnLayout(colIdx, weekDates);

                  return (
                    <div
                      key={slot.id}
                      className="absolute bg-tertiary/10 border border-dashed border-tertiary/30 rounded-md z-0 flex items-center justify-center text-tertiary font-bold hover:bg-tertiary/15 transition-colors duration-200"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `calc(40px + (100% - 40px) * ${leftPercent / 100} + 3px)`,
                        width: `calc((100% - 40px) * ${widthPercent / 100} - 5px)`,
                      }}
                      title="Free slot"
                    >
                      <span className="opacity-70 text-[10px] font-label uppercase tracking-widest">Free</span>
                    </div>
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
            {mockUpcomingTasks.map((task, idx) => (
              <div
                key={idx}
                className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 flex items-center justify-between gap-4 shadow-card hover:border-outline-variant/60 transition-all duration-200"
              >
                <div className="space-y-0.5">
                  <h5 className="text-[14px] font-bold text-on-surface font-sans">
                    {task.title}
                  </h5>
                  <p className="text-[12px] font-medium text-on-surface-variant font-label">
                    {task.blocks} blocks scheduled
                  </p>
                </div>
                <RiskBadge score={task.riskScore} />
              </div>
            ))}
          </div>
        </section>

      </div>
    </NavShell>
  );
}
