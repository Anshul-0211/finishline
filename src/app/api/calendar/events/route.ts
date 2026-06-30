import { NextRequest, NextResponse } from "next/server";
import { getCalendarClient, isGoogleCalendarConnected } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

/**
 * GET /api/calendar/events
 *
 * Fetches real Google Calendar events for the authenticated user.
 * Used by the frontend calendar UI to display the user's actual schedule
 * alongside FinishLine-managed commitment blocks.
 *
 * Query params:
 *   userId   - required - the Firebase UID
 *   timeMin  - optional - ISO 8601 start of range (default: start of today)
 *   timeMax  - optional - ISO 8601 end of range   (default: 14 days from now)
 *
 * Response: CalendarEvent[]
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = req.nextUrl;
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Default window: today → +14 days
    const now = new Date();
    const defaultMin = new Date(now);
    defaultMin.setHours(0, 0, 0, 0);
    const defaultMax = new Date(now);
    defaultMax.setDate(now.getDate() + 14);
    defaultMax.setHours(23, 59, 59, 999);

    const timeMin = searchParams.get("timeMin")
      ? new Date(searchParams.get("timeMin")!)
      : defaultMin;
    const timeMax = searchParams.get("timeMax")
      ? new Date(searchParams.get("timeMax")!)
      : defaultMax;

    if (isNaN(timeMin.getTime()) || isNaN(timeMax.getTime())) {
      return NextResponse.json(
        { error: "Invalid timeMin or timeMax — must be valid ISO 8601 strings" },
        { status: 400 }
      );
    }

    const connected = await isGoogleCalendarConnected(userId);
    if (!connected) {
      return NextResponse.json(
        { error: "Google Calendar not connected", details: "No refresh token found" },
        { status: 401 }
      );
    }

    const calendar = await getCalendarClient(userId);

    const res = await calendar.events.list({
      calendarId: "primary",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true,          // expand recurring events into individual instances
      orderBy: "startTime",
      maxResults: 250,             // safe ceiling; 14 days will rarely exceed this
      fields:
        "items(id,summary,description,start,end,colorId,status,location,organizer/email,attendees/email,attendees/responseStatus,recurringEventId)",
    });

    const rawEvents = res.data.items || [];

    // Normalise into a clean, frontend-friendly shape
    const events = rawEvents
      .filter((e) => e.status !== "cancelled")
      .map((e) => ({
        id: e.id ?? "",
        title: e.summary ?? "(No title)",
        description: e.description ?? null,
        // All-day events have `date`; timed events have `dateTime`
        start: e.start?.dateTime ?? e.start?.date ?? null,
        end: e.end?.dateTime ?? e.end?.date ?? null,
        isAllDay: Boolean(!e.start?.dateTime && e.start?.date),
        colorId: e.colorId ?? null,
        location: e.location ?? null,
        recurringEventId: e.recurringEventId ?? null,
        organizerEmail: e.organizer?.email ?? null,
        selfResponseStatus:
          e.attendees?.find((a) => a.email === e.organizer?.email)
            ?.responseStatus ?? null,
      }));

    return NextResponse.json(events, { status: 200 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface auth errors distinctly so the frontend can prompt re-auth
    if (
      msg.includes("invalid_grant") ||
      msg.includes("refresh token") ||
      msg.includes("Missing Google refresh token")
    ) {
      return NextResponse.json(
        { error: "Google Calendar not connected", details: msg },
        { status: 401 }
      );
    }
    console.error("[calendar/events] Failed to fetch events:", msg);
    return NextResponse.json(
      { error: "Failed to fetch calendar events", details: msg },
      { status: 500 }
    );
  }
}
