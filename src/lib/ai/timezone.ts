import { adminDb } from "@/lib/firebase/admin";

/**
 * Resolves the absolute correct timezone for a user to prevent timezone and 24-hour calendar drift.
 * Avoids raw un-zoned "UTC" string fallbacks by querying the user preferences from Firestore,
 * and falling back to system or regional standards.
 */
export async function resolveUserTimezone(userId: string, requestedTimezone?: string): Promise<string> {
  // 1. If requestedTimezone is explicitly provided, valid, and not "UTC", trust it.
  if (requestedTimezone && requestedTimezone !== "UTC" && requestedTimezone.trim() !== "") {
    return requestedTimezone;
  }

  // 2. Fetch the user profile preferences from Firestore if possible.
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const dbTimezone = userData?.preferences?.timezone;
      if (dbTimezone && dbTimezone !== "UTC" && dbTimezone.trim() !== "") {
        return dbTimezone;
      }
    }
  } catch (err) {
    console.warn(`[resolveUserTimezone] Failed to fetch timezone from Firestore for user ${userId}:`, err);
  }

  // 3. Fallback to system timezone if not UTC.
  if (typeof Intl !== "undefined") {
    const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (systemTimezone && systemTimezone !== "UTC") {
      return systemTimezone;
    }
  }

  // 4. Fall back to regional standard (Asia/Kolkata) instead of blind UTC.
  return "Asia/Kolkata";
}
