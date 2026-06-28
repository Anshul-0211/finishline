import { adminDb } from "@/lib/firebase/admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { User, Commitment } from "@/lib/types";
import { sendCheckInNotification } from "../fcm";

type DateInput = 
  | Date 
  | string 
  | number 
  | { toMillis: () => number } 
  | { toDate: () => Date } 
  | { _seconds: number; _nanoseconds?: number } 
  | { seconds: number; nanoseconds?: number }
  | null 
  | undefined;

// Helper to convert date inputs to millisecond epoch
function getMillis(val: DateInput): number {
  if (!val) return 0;
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === "number") {
    return val;
  }
  if (typeof val === "string") {
    return new Date(val).getTime();
  }
  if (typeof val === "object") {
    if ('toMillis' in val && typeof (val as { toMillis: unknown }).toMillis === "function") {
      return (val as { toMillis: () => number }).toMillis();
    }
    if ('toDate' in val && typeof (val as { toDate: unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate().getTime();
    }
    const rawVal = val as Record<string, unknown>;
    if (typeof rawVal._seconds === "number") {
      return rawVal._seconds * 1000 + Math.floor((rawVal._nanoseconds as number || 0) / 1000000);
    }
    if (typeof rawVal.seconds === "number") {
      return rawVal.seconds * 1000 + Math.floor((rawVal.nanoseconds as number || 0) / 1000000);
    }
  }
  return 0;
}

/**
 * Calculates the next check-in date based on remaining days until the deadline.
 */
export function calculateNextCheckIn(deadlineMs: number): Date {
  const now = Date.now();
  const remainingDays = (deadlineMs - now) / (24 * 60 * 60 * 1000);
  
  let hoursToAdd = 24;
  if (remainingDays > 7) {
    hoursToAdd = 48;
  } else if (remainingDays > 3) {
    hoursToAdd = 24;
  } else if (remainingDays > 1) {
    hoursToAdd = 12;
  } else {
    hoursToAdd = 4;
  }
  return new Date(now + hoursToAdd * 60 * 60 * 1000);
}

/**
 * Processes check-in checking and dispatching push notifications.
 */
export async function processCheckIns(user: User, commitments: Commitment[]): Promise<number> {
  const now = Date.now();
  let checkInsSent = 0;

  const activeCommitments = commitments.filter(c => c.status === "active" || c.status === "renegotiating");

  for (const c of activeCommitments) {
    const nextCheckIn = getMillis(c.nextCheckInAt);
    const deadline = getMillis(c.deadline);

    // Check-in is due if nextCheckIn <= now and is initialized
    if (nextCheckIn > 0 && nextCheckIn <= now) {
      // Find FCM token on preferences or directly on user document
      const fcmToken = user.preferences?.fcmToken || (user as any).fcmToken;
      
      const success = await sendCheckInNotification(fcmToken, c.id, c.title);
      
      // Calculate next check-in
      const nextCheckInDate = calculateNextCheckIn(deadline);

      await adminDb.collection("users").doc(user.uid).collection("commitments").doc(c.id).update({
        lastCheckInSentAt: FieldValue.serverTimestamp(),
        nextCheckInAt: Timestamp.fromDate(nextCheckInDate)
      });

      if (success) {
        checkInsSent++;
      }
    } else if (nextCheckIn === 0) {
      // Initialize nextCheckInAt if not set yet
      const nextCheckInDate = calculateNextCheckIn(deadline);
      await adminDb.collection("users").doc(user.uid).collection("commitments").doc(c.id).update({
        nextCheckInAt: Timestamp.fromDate(nextCheckInDate)
      });
    }
  }

  return checkInsSent;
}
