import { adminDb } from "@/lib/firebase/admin";
import { User, Commitment } from "@/lib/types";

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
  const snap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("status", "in", ["active", "renegotiating"])
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Commitment));
}
