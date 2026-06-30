import { adminDb } from "@/lib/firebase/admin";
import { User, TimeSlot } from "@/lib/types";
import { Timestamp } from "firebase-admin/firestore";
import { google } from "googleapis";
import { getFreshAccessToken } from "@/lib/services/auth/token-refresher";

/**
 * Returns a deterministic list of mock busy periods for validation.
 * Default: 12:00 PM to 2:00 PM every day.
 */
export function getMockBusyPeriods(start: Date, end: Date): TimeSlot[] {
  const busySlots: TimeSlot[] = [];
  const curr = new Date(start);
  while (curr < end) {
    const slotStart = new Date(curr);
    slotStart.setHours(12, 0, 0, 0);
    const slotEnd = new Date(curr);
    slotEnd.setHours(14, 0, 0, 0);
    
    busySlots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString()
    });
    
    curr.setDate(curr.getDate() + 1);
  }
  return busySlots;
}

/**
 * Retrieves the googleapis Calendar client for a given user.
 * Automatically handles token refresh.
 */
export async function getCalendarClient(userId: string) {
  const freshAccessToken = await getFreshAccessToken(userId, "calendar");

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth Client ID or Client Secret is not set in environment.");
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:3000"
  );

  oauth2Client.setCredentials({
    access_token: freshAccessToken
  });

  return google.calendar({ version: "v3", auth: oauth2Client });
}

/**
 * Checks if a user is actively connected to Google Calendar.
 * Returns false if the refresh token is missing, undefined, or explicitly "false" / false.
 */
export async function isGoogleCalendarConnected(userId: string): Promise<boolean> {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return false;
  }
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) return false;
    const user = userDoc.data();
    if (!user) return false;
    
    const token = user.googleCalendarRefreshToken || user.googleRefreshToken;
    return !!(token && token !== "false" && token !== "undefined" && token !== false);
  } catch (err: unknown) {
    console.error(`[Calendar] Error checking connection status for user ${userId}:`, err);
    return false;
  }
}

/**
 * Checks and refreshes Google OAuth tokens if expired or close to expiry.
 * (Preserved from reading service, using getCalendarClient for auth checks)
 */
async function getValidAccessToken(userId: string, user: User): Promise<string | null> {
  try {
    const client = await getCalendarClient(userId);
    const auth = client.context._options.auth as any;
    const tokens = await auth.getAccessToken();
    return tokens.token || null;
  } catch (err: unknown) {
    console.warn(`[Calendar] getValidAccessToken failed: ${err}`);
    return null;
  }
}

/**
 * Retrieves primary calendar busy periods between start and end.
 */
export async function getCalendarBusyPeriods(userId: string, start: Date, end: Date): Promise<TimeSlot[]> {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return getMockBusyPeriods(start, end);
  }
  try {
    const connected = await isGoogleCalendarConnected(userId);
    if (!connected) {
      console.log(`[Calendar] Google Calendar not connected for user ${userId}. Returning mock busy periods.`);
      return getMockBusyPeriods(start, end);
    }

    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return getMockBusyPeriods(start, end);
    }
    const user = userDoc.data() as User;

    const accessToken = await getValidAccessToken(userId, user);
    if (!accessToken) {
      return getMockBusyPeriods(start, end);
    }

    // Call Google Calendar freeBusy query
    const res = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        items: [{ id: "primary" }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[Calendar] Google FreeBusy API failed: ${res.statusText} - ${errText}. Falling back to mock.`);
      return getMockBusyPeriods(start, end);
    }

    const data = await res.json();
    const busy = data.calendars?.primary?.busy || [];
    
    return busy.map((b: { start: string; end: string }) => ({
      start: b.start,
      end: b.end
    }));

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Calendar] getCalendarBusyPeriods failed: ${msg}. Falling back to mock.`);
    return getMockBusyPeriods(start, end);
  }
}

/**
 * Creates a single Google Calendar event.
 */
export async function createCalendarEvent(userId: string, event: any): Promise<string> {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return "mock-event-id-" + Math.random().toString(36).substring(2, 9);
  }
  try {
    const connected = await isGoogleCalendarConnected(userId);
    if (!connected) {
      return "local-event-id-" + Math.random().toString(36).substring(2, 9);
    }

    const calendar = await getCalendarClient(userId);
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const calendarId = userDoc.data()?.googleCalendarId || "primary";

    const res = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    if (!res.data.id) {
      throw new Error("Failed to retrieve event ID from calendar insert response.");
    }
    return res.data.id;
  } catch (err: any) {
    const errorMsg = err.message || "";
    const errorData = err.response?.data?.error || "";
    if (errorMsg.includes("invalid_grant") || errorData === "invalid_grant" || errorData?.message?.includes("invalid_grant")) {
      console.warn(`[Calendar] Google token invalid_grant for user ${userId}. Falling back to local ID.`);
      return "local-event-id-" + Math.random().toString(36).substring(2, 9);
    }
    throw new Error(`Failed to create calendar event: ${err.message}`);
  }
}

/**
 * Updates an existing Google Calendar event.
 */
export async function updateCalendarEvent(userId: string, eventId: string, updates: any): Promise<void> {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return;
  }
  if (!eventId || eventId.startsWith("local-") || eventId.startsWith("mock-")) {
    return;
  }
  try {
    const connected = await isGoogleCalendarConnected(userId);
    if (!connected) {
      return;
    }

    const calendar = await getCalendarClient(userId);
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const calendarId = userDoc.data()?.googleCalendarId || "primary";

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: updates,
    });
  } catch (err: any) {
    const errorMsg = err.message || "";
    const errorData = err.response?.data?.error || "";
    if (errorMsg.includes("invalid_grant") || errorData === "invalid_grant" || errorData?.message?.includes("invalid_grant")) {
      console.warn(`[Calendar] Google token invalid_grant during update for event ${eventId}.`);
      return;
    }
    throw new Error(`Failed to update calendar event ${eventId}: ${err.message}`);
  }
}

/**
 * Deletes an existing Google Calendar event.
 */
export async function deleteCalendarEvent(userId: string, eventId: string): Promise<void> {
  if (process.env.FINISHLINE_VALIDATION_MOCK === "true") {
    return;
  }
  if (!eventId || eventId.startsWith("local-") || eventId.startsWith("mock-")) {
    return;
  }
  try {
    const connected = await isGoogleCalendarConnected(userId);
    if (!connected) {
      return;
    }

    const calendar = await getCalendarClient(userId);
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const calendarId = userDoc.data()?.googleCalendarId || "primary";

    await calendar.events.delete({
      calendarId,
      eventId,
    });
  } catch (err: any) {
    const status = err.status || err.response?.status;
    if (status === 404 || status === 410) {
      console.warn(`[Calendar] Event ${eventId} was already deleted or not found.`);
      return;
    }
    const errorMsg = err.message || "";
    const errorData = err.response?.data?.error || "";
    if (errorMsg.includes("invalid_grant") || errorData === "invalid_grant" || errorData?.message?.includes("invalid_grant")) {
      console.warn(`[Calendar] Google token invalid_grant during delete for event ${eventId}.`);
      return;
    }
    throw new Error(`Failed to delete calendar event ${eventId}: ${err.message}`);
  }
}

/**
 * Batch-writes scheduled blocks of a commitment to Google Calendar with automatic rollback support.
 */
export async function writeCommitmentBlocks(
  userId: string,
  commitmentId: string,
  blocks: { start: string; end: string }[]
): Promise<string[]> {
  const commitmentDoc = await adminDb
    .collection("users")
    .doc(userId)
    .collection("commitments")
    .doc(commitmentId)
    .get();

  if (!commitmentDoc.exists) {
    throw new Error(`Commitment ${commitmentId} not found.`);
  }
  const commitment = commitmentDoc.data()!;
  const createdEventIds: string[] = [];

  const connected = await isGoogleCalendarConnected(userId);

  try {
    if (connected) {
      for (const block of blocks) {
        const event = {
          summary: `[FinishLine] ${commitment.title}`,
          description: `Scheduled work block for commitment: "${commitment.title}"\nCommitment ID: ${commitmentId}`,
          start: {
            dateTime: new Date(block.start).toISOString(),
          },
          end: {
            dateTime: new Date(block.end).toISOString(),
          },
        };

        const eventId = await createCalendarEvent(userId, event);
        createdEventIds.push(eventId);
      }
    } else {
      console.log(`[Calendar] Google Calendar not connected for user ${userId}. Assigning local-only block IDs.`);
      for (let i = 0; i < blocks.length; i++) {
        createdEventIds.push("local-event-id-" + Math.random().toString(36).substring(2, 9));
      }
    }

    // Write event IDs back to Firestore commitment document
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId)
      .update({
        calendarEventIds: createdEventIds,
        // Also update scheduledBlocks to include calendarEventIds
        scheduledBlocks: blocks.map((b, idx) => ({
          ...b,
          calendarEventId: createdEventIds[idx]
        }))
      });

    return createdEventIds;

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[Calendar] Failed to write commitment blocks to Google Calendar. Falling back to local-only save: ${msg}`);

    // Rollback: delete any google events created in this failed batch (if any)
    for (const id of createdEventIds) {
      if (id && !id.startsWith("local-") && !id.startsWith("mock-")) {
        try {
          await deleteCalendarEvent(userId, id);
        } catch (rollbackErr: unknown) {
          console.error(`[Calendar] Rollback failed to delete event ${id}:`, rollbackErr);
        }
      }
    }

    // Always ensure local-only blocks are saved to Firestore even on Google API failures!
    const fallbackEventIds = blocks.map((_, idx) => createdEventIds[idx] || "local-event-id-" + Math.random().toString(36).substring(2, 9));
    try {
      await adminDb
        .collection("users")
        .doc(userId)
        .collection("commitments")
        .doc(commitmentId)
        .update({
          calendarEventIds: fallbackEventIds,
          scheduledBlocks: blocks.map((b, idx) => ({
            ...b,
            calendarEventId: fallbackEventIds[idx]
          }))
        });
      console.log(`[Calendar] Resiliently saved local-only blocks to Firestore after Google write error.`);
      return fallbackEventIds;
    } catch (saveErr: any) {
      console.error(`[Calendar] Critical: Failed to save fallback local blocks to Firestore:`, saveErr);
      throw new Error(`Failed to write commitment blocks: ${msg}`);
    }
  }
}
