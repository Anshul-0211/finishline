import { adminDb } from "../firebase/admin";
import { decrypt, encrypt } from "../auth/tokenEncryption";
import { Timestamp } from "firebase-admin/firestore";
import { TimeSlot } from "../ai/types";

export class CalendarError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "CalendarError";
    this.code = code;
  }
}

/**
 * Retrieves the user's decrypted tokens, refreshes them if expired or close to expiry,
 * and returns a valid access token.
 */
async function getValidAccessToken(userId: string): Promise<string> {
  const userRef = adminDb.collection("users").doc(userId);
  const userDoc = await userRef.get();

  if (!userDoc.exists) {
    throw new CalendarError("User not found", "USER_NOT_FOUND");
  }

  const userData = userDoc.data();
  if (!userData) {
    throw new CalendarError("User data is empty", "USER_DATA_EMPTY");
  }

  const { googleAccessToken, googleRefreshToken, tokenExpiry } = userData;

  if (!googleAccessToken) {
    throw new CalendarError("Google Access Token is missing. Please sign in with Google.", "CALENDAR_UNAVAILABLE");
  }

  const decryptedAccessToken = decrypt(googleAccessToken);
  const decryptedRefreshToken = googleRefreshToken ? decrypt(googleRefreshToken) : "";

  // Check if token is expired or will expire in the next 5 minutes
  let isExpired = true;
  if (tokenExpiry) {
    const expiryMs = (tokenExpiry instanceof Timestamp ? tokenExpiry.toDate() : new Date(tokenExpiry)).getTime();
    isExpired = expiryMs - 5 * 60 * 1000 <= Date.now();
  }

  if (!isExpired) {
    return decryptedAccessToken;
  }

  // If expired, refresh it using refresh token
  if (!decryptedRefreshToken) {
    throw new CalendarError("Refresh token is missing. Please re-authenticate.", "CALENDAR_UNAVAILABLE");
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: decryptedRefreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new CalendarError(`Token refresh failed: ${errorText}`, "CALENDAR_UNAVAILABLE");
    }

    const data = await response.json();
    const newAccessToken = data.access_token;
    const expiresIn = data.expires_in || 3600;

    const encryptedAccessToken = encrypt(newAccessToken);
    const newExpiry = Timestamp.fromMillis(Date.now() + expiresIn * 1000);

    const updateData: any = {
      googleAccessToken: encryptedAccessToken,
      tokenExpiry: newExpiry,
      updatedAt: Timestamp.now(),
    };

    // If a new refresh token is returned, update it too
    if (data.refresh_token) {
      updateData.googleRefreshToken = encrypt(data.refresh_token);
    }

    await userRef.update(updateData);
    return newAccessToken;
  } catch (error: any) {
    console.error("Error refreshing Google OAuth token:", error);
    throw new CalendarError(error.message || "Failed to refresh OAuth token", "CALENDAR_UNAVAILABLE");
  }
}

/**
 * Calls the Google Calendar API freebusy endpoint for the user's primary calendar
 * and calculates the free time slots (the gaps between busy slots) for the next N days.
 */
export async function getCalendarFreeSlots(
  userId: string,
  options: { days: number }
): Promise<TimeSlot[]> {
  try {
    const accessToken = await getValidAccessToken(userId);

    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + options.days * 24 * 60 * 60 * 1000).toISOString();

    const response = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: "primary" }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google freebusy API returned error: ${response.status} - ${errorText}`);
      throw new CalendarError(`Calendar API error: ${errorText}`, "CALENDAR_UNAVAILABLE");
    }

    const data = await response.json();
    const busySlots = data.calendars?.primary?.busy || [];

    // Parse and sort busy slots by start time
    const parsedBusy = busySlots.map((slot: any) => ({
      start: new Date(slot.start),
      end: new Date(slot.end),
    })).sort((a: any, b: any) => a.start.getTime() - b.start.getTime());

    // Merge overlapping/adjacent busy intervals
    const mergedBusy: { start: Date; end: Date }[] = [];
    for (const slot of parsedBusy) {
      if (mergedBusy.length === 0) {
        mergedBusy.push(slot);
      } else {
        const last = mergedBusy[mergedBusy.length - 1];
        if (slot.start.getTime() <= last.end.getTime()) {
          if (slot.end.getTime() > last.end.getTime()) {
            last.end = slot.end;
          }
        } else {
          mergedBusy.push(slot);
        }
      }
    }

    const freeSlots: TimeSlot[] = [];
    const minDate = new Date(timeMin);
    const maxDate = new Date(timeMax);
    let currentStart = minDate;

    for (const busy of mergedBusy) {
      if (busy.start.getTime() > currentStart.getTime()) {
        const diffMinutes = (busy.start.getTime() - currentStart.getTime()) / (60 * 1000);
        if (diffMinutes >= 30) {
          freeSlots.push({
            start: currentStart.toISOString(),
            end: busy.start.toISOString(),
          });
        }
      }
      if (busy.end.getTime() > currentStart.getTime()) {
        currentStart = busy.end;
      }
    }

    if (maxDate.getTime() > currentStart.getTime()) {
      const diffMinutes = (maxDate.getTime() - currentStart.getTime()) / (60 * 1000);
      if (diffMinutes >= 30) {
        freeSlots.push({
          start: currentStart.toISOString(),
          end: maxDate.toISOString(),
        });
      }
    }

    return freeSlots;
  } catch (error: any) {
    if (error instanceof CalendarError) {
      throw error;
    }
    console.error("getCalendarFreeSlots failed:", error);
    throw new CalendarError(error.message || "Failed to fetch calendar slots", "CALENDAR_UNAVAILABLE");
  }
}

/**
 * Creates a Google Calendar event for the user.
 */
export async function writeCalendarBlock(
  userId: string,
  block: { title: string; start: string; end: string; description?: string; commitmentId: string }
): Promise<string> {
  try {
    const accessToken = await getValidAccessToken(userId);

    const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: block.title,
        description: block.description || `FinishLine Commitment Block for ${block.commitmentId}`,
        start: { dateTime: block.start },
        end: { dateTime: block.end },
        extendedProperties: {
          private: {
            commitmentId: block.commitmentId,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google event create API returned error: ${response.status} - ${errorText}`);
      throw new CalendarError(`Calendar API error: ${errorText}`, "CALENDAR_UNAVAILABLE");
    }

    const data = await response.json();
    if (!data.id) {
      throw new CalendarError("Failed to obtain calendar event ID", "CALENDAR_UNAVAILABLE");
    }

    return data.id;
  } catch (error: any) {
    if (error instanceof CalendarError) {
      throw error;
    }
    console.error("writeCalendarBlock failed:", error);
    throw new CalendarError(error.message || "Failed to create calendar event", "CALENDAR_UNAVAILABLE");
  }
}

/**
 * Deletes a Google Calendar event for the user.
 */
export async function deleteCalendarBlock(userId: string, calendarEventId: string): Promise<void> {
  try {
    const accessToken = await getValidAccessToken(userId);

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${calendarEventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Event already deleted or not found, handle gracefully
        console.warn(`Calendar event ${calendarEventId} not found (404), treating as deleted.`);
        return;
      }
      const errorText = await response.text();
      console.error(`Google event delete API returned error: ${response.status} - ${errorText}`);
      throw new CalendarError(`Calendar API error: ${errorText}`, "CALENDAR_UNAVAILABLE");
    }
  } catch (error: any) {
    if (error instanceof CalendarError) {
      // 404 was handled, throw other errors
      if (error.code !== "USER_NOT_FOUND" && error.code !== "USER_DATA_EMPTY") {
        throw error;
      }
    }
    console.error("deleteCalendarBlock failed:", error);
    // Silent failover/logging is okay for delete except critical errors
  }
}
