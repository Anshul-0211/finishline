"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, onSnapshot } from "firebase/firestore";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { Calendar as CalendarIcon, Info } from "lucide-react";
import styles from "./calendar.module.css";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), // Week starts on Monday
  getDay,
  locales: { "en-US": enUS },
});

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: {
    commitmentId: string;
    domain: string;
    riskScore: number;
    riskTrend: string;
    calendarSyncStatus: "synced" | "pending";
  };
}

export default function CalendarPage() {
  const { user } = useUserStore();
  const router = useRouter();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"week" | "day">("week");
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    if (!user?.uid) return;

    // Load active commitments blocks
    const commitmentsRef = collection(db, "users", user.uid, "commitments");
    const unsubscribe = onSnapshot(commitmentsRef, (snap) => {
      const flattenedEvents: CalendarEvent[] = [];

      snap.forEach((docSnap) => {
        const commitment = docSnap.data();
        if (commitment.status !== "active") return;

        const blocks = commitment.calendarBlocks || [];
        blocks.forEach((block: any, idx: number) => {
          flattenedEvents.push({
            id: `${docSnap.id}_block_${idx}`,
            title: block.title || commitment.title,
            start: new Date(block.start),
            end: new Date(block.end),
            resource: {
              commitmentId: docSnap.id,
              domain: commitment.domain,
              riskScore: commitment.riskScore || 0,
              riskTrend: commitment.riskTrend || "stable",
              calendarSyncStatus: commitment.calendarSyncStatus || "synced",
            },
          });
        });
      });

      setEvents(flattenedEvents);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Event style mapper
  const eventStyleGetter = (event: CalendarEvent) => {
    const { domain, riskScore, calendarSyncStatus } = event.resource;

    let borderLeftColor = "#10B981"; // Green default
    let backgroundColor = "rgba(16, 185, 129, 0.10)";

    if (domain === "work") {
      borderLeftColor = "#7C3AED"; // Purple
      backgroundColor = "rgba(124, 58, 237, 0.10)";
    } else if (riskScore > 70) {
      borderLeftColor = "#EF4444"; // Red
      backgroundColor = "rgba(239, 68, 68, 0.12)";
    } else if (riskScore > 40) {
      borderLeftColor = "#F59E0B"; // Amber
      backgroundColor = "rgba(245, 158, 11, 0.10)";
    }

    const style: any = {
      borderLeft: `3px solid ${borderLeftColor}`,
      backgroundColor,
      padding: "4px 8px",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      justifyContent: "flex-start",
      color: "#E6EDF3",
      fontSize: "11px",
      lineHeight: "1.2",
    };

    if (calendarSyncStatus === "pending") {
      style.opacity = "0.55";
      style.borderLeft = `3px dashed ${borderLeftColor}`;
    }

    return { style };
  };

  // Custom Event block renderer inside the grid
  const CustomEventComponent = ({ event }: { event: CalendarEvent }) => {
    const { commitmentId, riskScore, calendarSyncStatus } = event.resource;

    return (
      <div
        onClick={() => router.push(`/dashboard/commitments/${commitmentId}`)}
        className="h-full w-full flex flex-col justify-between cursor-pointer select-none relative group pr-6"
      >
        <div className="min-w-0">
          <p className="font-bold truncate text-[11px] text-white leading-tight">
            {event.title}
          </p>
          <p className="text-[10px] text-[#8B949E] mt-0.5 font-medium leading-none">
            {format(event.start, "h:mm")} - {format(event.end, "h:mm a")}
          </p>
        </div>

        {/* Sync pending icon */}
        {calendarSyncStatus === "pending" && (
          <div className="absolute right-1 bottom-1 text-amber-500" title="Calendar sync pending">
            <CalendarIcon className="w-3.5 h-3.5" />
          </div>
        )}

        {/* High risk bubble */}
        {riskScore > 70 && (
          <span className="absolute top-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none">
            {riskScore}
          </span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-3">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-[#8B949E]">Loading your week view...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white pb-12">
      {/* Header toolbar */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#30363D] pb-5">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-white">Your week</h1>
          <p className="text-sm text-[#8B949E]">
            {events.length} scheduled commitment blocks tracked
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setDate(new Date())}
            className="py-2 px-4 rounded-xl bg-[#21262D] border border-[#30363D] hover:border-[#8b949e]/40 hover:text-white transition text-xs font-semibold text-[#8B949E] cursor-pointer"
          >
            Today
          </button>
          
          {/* View toggle */}
          <div className="flex bg-[#21262D] border border-[#30363D] p-1 rounded-xl">
            {(["week", "day"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`py-1.5 px-4 text-xs font-bold rounded-lg transition capitalize cursor-pointer select-none ${
                  view === v
                    ? "bg-[#30363D] text-white"
                    : "text-[#8B949E] hover:text-white"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Calendar body */}
      <div className={`h-[calc(100vh-220px)] ${styles.calendarContainer}`}>
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          onView={(v: any) => setView(v)}
          date={date}
          onNavigate={(d) => setDate(d)}
          defaultView="week"
          views={["week", "day"]}
          step={30}
          timeslots={2}
          eventPropGetter={eventStyleGetter}
          components={{ event: CustomEventComponent }}
          style={{ height: "100%" }}
        />
      </div>

      {/* Footer Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#161B22] border border-[#30363D] px-6 py-4 rounded-2xl text-xs text-[#8B949E] shadow-sm select-none">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-semibold text-white uppercase tracking-wider text-[10px] mr-2">
            Legend:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
            <span>High Risk (&gt;70)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
            <span>Medium Risk (40-70)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span>Low Risk (&lt;40)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded bg-[#7C3AED]" />
            <span>Work Domain</span>
          </div>
        </div>

        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline flex items-center gap-1 font-semibold"
        >
          Open Google Calendar →
        </a>
      </div>
    </div>
  );
}
