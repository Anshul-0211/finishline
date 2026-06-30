import { adminDb } from "@/lib/firebase/admin";
import { User, Commitment, firestoreToCommitment } from "@/lib/types";

/**
 * Fetches all active users in the system.
 */
export async function getAllActiveUsers(): Promise<User[]> {
  const snap = await adminDb.collection("users").get();
  return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
}

/**
 * Fetches all active/renegotiating commitments for a given user.
 */
export async function getActiveCommitmentsForUser(userId: string): Promise<Commitment[]> {
  const commitmentsRef = adminDb.collection("users").doc(userId).collection("commitments");

  // Query 1: Active and dirty commitments (newly created or recently modified)
  const q1 = commitmentsRef
    .where("status", "in", ["active", "renegotiating"])
    .where("isDirty", "==", true)
    .get();

  // Query 2: Active, clean commitments that haven't been evaluated in the last 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const q2 = commitmentsRef
    .where("status", "in", ["active", "renegotiating"])
    .where("isDirty", "==", false)
    .where("lastEvaluatedAt", "<", fourHoursAgo)
    .get();

  const [snap1, snap2] = await Promise.all([q1, q2]);

  // Merge and de-duplicate by doc ID
  const docsMap = new Map<string, any>();
  snap1.docs.forEach((doc: any) => docsMap.set(doc.id, doc));
  snap2.docs.forEach((doc: any) => docsMap.set(doc.id, doc));

  return Array.from(docsMap.values()).map((doc: any) => firestoreToCommitment(doc as any));
}
