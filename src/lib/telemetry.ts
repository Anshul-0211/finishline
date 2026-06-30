import { adminDb } from "@/lib/firebaseAdmin";

export interface FocusSessionTelemetry {
  commitmentId: string;
  startTime: string; // ISO 8601
  endTime: string | null; // ISO 8601
  eventType: 'start' | 'pause' | 'resume' | 'stop' | 'complete';
  durationSeconds: number;
  uninterruptedFocusMinutes: number;
  terminationState: 'completed' | 'abandoned' | 'paused';
  timestamp: string; // ISO 8601
}

/**
 * Writes a focus session telemetry event to the user's Firestore focusSessions subcollection.
 */
export async function writeFocusEvent(userId: string, data: FocusSessionTelemetry): Promise<string> {
  // Validate required fields
  if (!userId) {
    throw new Error("Missing userId for logging telemetry");
  }
  if (!data.commitmentId) {
    throw new Error("Missing commitmentId for logging telemetry");
  }
  if (!['start', 'pause', 'resume', 'stop', 'complete'].includes(data.eventType)) {
    throw new Error(`Invalid eventType: ${data.eventType}`);
  }
  if (!['completed', 'abandoned', 'paused'].includes(data.terminationState)) {
    throw new Error(`Invalid terminationState: ${data.terminationState}`);
  }
  if (typeof data.durationSeconds !== 'number' || data.durationSeconds < 0) {
    throw new Error("durationSeconds must be a non-negative number");
  }
  if (typeof data.uninterruptedFocusMinutes !== 'number' || data.uninterruptedFocusMinutes < 0) {
    throw new Error("uninterruptedFocusMinutes must be a non-negative number");
  }

  console.log(`[Telemetry] Writing focus event '${data.eventType}' for user ${userId}, commitment ${data.commitmentId}`);
  
  const docRef = await adminDb
    .collection("users")
    .doc(userId)
    .collection("focusSessions")
    .add({
      commitmentId: data.commitmentId,
      startTime: data.startTime,
      endTime: data.endTime,
      eventType: data.eventType,
      durationSeconds: data.durationSeconds,
      uninterruptedFocusMinutes: data.uninterruptedFocusMinutes,
      terminationState: data.terminationState,
      timestamp: data.timestamp,
    });

  return docRef.id;
}
