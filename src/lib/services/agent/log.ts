import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export interface AgentRunLog {
  runAt: FieldValue;
  usersProcessed: number;
  commitmentsProcessed: number;
  collisionsDetected: number;
  checkInsSent: number;
  errors: string[];
}

/**
 * Writes agent run metrics to the agentRuns Firestore collection.
 */
export async function logAgentRun(log: Omit<AgentRunLog, 'runAt'>): Promise<void> {
  try {
    await adminDb.collection("agentRuns").add({
      ...log,
      runAt: FieldValue.serverTimestamp()
    });
    console.log("[Agent Log] Agent run successfully logged to Firestore.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Agent Log] Failed to write agent run log to Firestore: ${msg}`);
  }
}
