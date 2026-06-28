import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCalendarClient } from "@/lib/services/calendar";
import { User } from "@/lib/types";

export const dynamic = "force-dynamic";

interface TimeSlot {
  start: string; // ISO 8601
  end: string;   // ISO 8601
}

/**
 * Subtracts busy periods from a working-hours window to produce free slots.
 *
 * @param workStart  Hour (0–23) when the user starts work (inclusive)
 * @param workEnd    Hour (0–23) when the user stops work (exclusive)
 * @param busyPeriods Array of {start, end} ISO strings from Google freeBusy
 * @param days       Number of days to compute (starting from today)
 * @param minSlotMinutes Minimum useful slot length in minutes (default 30)
 */
function computeFreeSlots(
  workStart: number,
  workEnd: number,
  busyPeriods: TimeSlot[],
  days: number,
  minSlotMinutes = 30
): TimeSlot[] {
  const freeSlots: TimeSlot[] = [];
  const now = new Date();

  for (let i = 0; i < days; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);

    // Working window for this day (in ms)
    const dayStart = new Date(day);
    dayStart.setHours(workStart, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(workEnd, 0, 0, 0);

    // If this is today, start from current time (rounded up to next 30 min)
    let cursor = i === 0 && now > dayStart ? new Date(now) : new Date(dayStart);
    if (i === 0 && now > dayStart) {
      // Round up to next 30-min boundary
      const mins = cursor.getMinutes();
      const rounded = Math.ceil(mins / 30) * 30;
      cursor.setMinutes(rounded, 0, 0);
    }

    // Collect busy periods that overlap this day's working window
    const dayBusy = busyPeriods
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .filter((b) => b.end > dayStart && b.start < dayEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // Walk through busy periods, filling in gaps as free slots
    for (const busy of dayBusy) {
      const busyStart = busy.start < dayStart ? dayStart : busy.start;
      const busyEnd = busy.end > dayEnd ? dayEnd : busy.end;

      if (cursor < busyStart) {
        const durationMs = busyStart.getTime() - cursor.getTime();
        if (durationMs >= minSlotMinutes * 60_000) {
          freeSlots.push({
            start: cursor.toISOString(),
            end: busyStart.toISOString(),
          });
        }
      }
      // Advance cursor past this busy block
      if (busyEnd > cursor) {
        cursor = new Date(busyEnd);
      }
    }

    // Remaining time after last busy block
    if (cursor < dayEnd) {
      const durationMs = dayEnd.getTime() - cursor.getTime();
      if (durationMs >= minSlotMinutes * 60_000) {
        freeSlots.push({
          start: cursor.toISOString(),
          end: dayEnd.toISOString(),
        });
      }
    }
  }

  return freeSlots;
}

/**
 * GET /api/calendar/free-slots
 *
 * Computes real free time slots by querying Google Calendar freeBusy and
 * subtracting busy periods from the user's configured working hours window.
 *
 * This replaces the mock in lib/ai/context.ts and is also usable directly
 * by the frontend to render available time in a calendar UI.
 *
 * Query params:
 *   userId - required
 *   days   - optional, number of days to compute (default 7, max 30)
 *   minSlotMinutes - optional, minimum slot length in minutes (default 30)
 *
 * Response: FreeSlotsResponse
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    const days = Math.min(
      parseInt(searchParams.get("days") ?? "7", 10),
      30
    );
    const minSlotMinutes = parseInt(
      searchParams.get("minSlotMinutes") ?? "30",
      10
    );

    // 1. Fetch user preferences for working hours
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const user = userDoc.data() as User;
    const workStart: number = user.preferences?.workingHours?.start ?? 9;
    const workEnd: number = user.preferences?.workingHours?.end ?? 18;

    // 2. Fetch busy periods from Google Calendar freeBusy API
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(now.getDate() + days);
    rangeEnd.setHours(23, 59, 59, 999);

    let busyPeriods: TimeSlot[] = [];
    let calendarConnected = true;

    try {
      const calendar = await getCalendarClient(userId);
      const freeBusyRes = await calendar.freebusy.query({
        requestBody: {
          timeMin: rangeStart.toISOString(),
          timeMax: rangeEnd.toISOString(),
          items: [{ id: "primary" }],
        },
      });
      const rawBusy = freeBusyRes.data.calendars?.primary?.busy ?? [];
      busyPeriods = rawBusy.map((b) => ({
        start: b.start ?? "",
        end: b.end ?? "",
      }));
    } catch (calErr: unknown) {
      const msg = calErr instanceof Error ? calErr.message : String(calErr);
      // If calendar isn't connected fall back to empty busy list
      // (all working hours are "free") and flag it in the response
      if (
        msg.includes("invalid_grant") ||
        msg.includes("refresh token") ||
        msg.includes("Missing Google refresh token")
      ) {
        calendarConnected = false;
        console.warn(
          "[calendar/free-slots] Google Calendar not connected — computing slots from working hours only"
        );
      } else {
        throw calErr; // re-throw unexpected errors
      }
    }

    // 3. Compute free slots
    const freeSlots = computeFreeSlots(
      workStart,
      workEnd,
      busyPeriods,
      days,
      minSlotMinutes
    );

    return NextResponse.json(
      {
        freeSlots,
        meta: {
          workingHours: { start: workStart, end: workEnd },
          computedAt: new Date().toISOString(),
          daysComputed: days,
          calendarConnected,
          busyPeriodsCount: busyPeriods.length,
          freeSlotsCount: freeSlots.length,
        },
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[calendar/free-slots] Failed to compute free slots:", msg);
    return NextResponse.json(
      { error: "Failed to compute free slots", details: msg },
      { status: 500 }
    );
  }
}
