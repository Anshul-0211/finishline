import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { Commitment, TimeSlot } from "@/lib/types";
import { getCalendarBusyPeriods } from "../calendar";

interface CollisionResult {
  commitmentId: string;
  conflictType: 'calendar' | 'commitment';
  conflictDetails: string;
  collidingCommitmentIds: string[];
}

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
 * Detects scheduling collisions for a user's commitments against Google Calendar and other commitments.
 */
export async function detectCollisions(userId: string, commitments: Commitment[]): Promise<CollisionResult[]> {
  const start = new Date();
  const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  // 1. Fetch calendar busy periods
  const busyPeriods = await getCalendarBusyPeriods(userId, start, end);
  const collisions: CollisionResult[] = [];

  // Filter only active or renegotiating commitments
  const activeCommitments = commitments.filter(c => c.status === "active" || c.status === "renegotiating");

  for (const c of activeCommitments) {
    let hasCalConflict = false;
    let calConflictDetails = "";
    const collidingIdsSet = new Set<string>();
    const commitmentConflicts: string[] = [];

    const scheduledBlocks = c.scheduledBlocks || [];
    for (const block of scheduledBlocks) {
      const blockStart = getMillis(block.start);
      const blockEnd = getMillis(block.end);
      if (blockStart === 0 || blockEnd === 0) continue;

      // A. Check against calendar busy periods
      for (const busy of busyPeriods) {
        const busyStart = getMillis(busy.start);
        const busyEnd = getMillis(busy.end);
        if (busyStart === 0 || busyEnd === 0) continue;

        const overlaps = Math.max(blockStart, busyStart) < Math.min(blockEnd, busyEnd);
        if (overlaps) {
          hasCalConflict = true;
          const startTimeStr = new Date(busyStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const endTimeStr = new Date(busyEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = new Date(busyStart).toLocaleDateString([], { month: 'short', day: 'numeric' });
          calConflictDetails = `Overlaps Google Calendar busy slot on ${dateStr} (${startTimeStr} - ${endTimeStr})`;
          break; // stop checking calendar slots for this block once a collision is found
        }
      }

      // B. Check against other commitments' scheduled blocks
      for (const other of activeCommitments) {
        if (other.id === c.id) continue;
        const otherBlocks = other.scheduledBlocks || [];
        for (const otherBlock of otherBlocks) {
          const otherStart = getMillis(otherBlock.start);
          const otherEnd = getMillis(otherBlock.end);
          if (otherStart === 0 || otherEnd === 0) continue;

          const overlaps = Math.max(blockStart, otherStart) < Math.min(blockEnd, otherEnd);
          if (overlaps) {
            collidingIdsSet.add(other.id);
            commitmentConflicts.push(`Work block conflicts with "${other.title}"`);
          }
        }
      }
    }

    // Record collision if any conflict was detected
    if (hasCalConflict) {
      collisions.push({
        commitmentId: c.id,
        conflictType: "calendar",
        conflictDetails: calConflictDetails,
        collidingCommitmentIds: Array.from(collidingIdsSet)
      });
    } else if (commitmentConflicts.length > 0) {
      collisions.push({
        commitmentId: c.id,
        conflictType: "commitment",
        conflictDetails: commitmentConflicts[0], // report the first commitment conflict
        collidingCommitmentIds: Array.from(collidingIdsSet)
      });
    }
  }

  return collisions;
}

/**
 * Executes the COLLIDE step: detects conflicts, updates commitments, and updates the user's collisions subcollection.
 */
export async function processCollisions(userId: string, commitments: Commitment[]): Promise<void> {
  // 1. Detect conflicts
  const collisions = await detectCollisions(userId, commitments);

  // 2. Clear old collisions subcollection entries for this user
  const collisionsColRef = adminDb.collection("users").doc(userId).collection("collisions");
  const oldCollisionsSnap = await collisionsColRef.get();
  const batch = adminDb.batch();
  oldCollisionsSnap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // 3. Update commitment documents and write to user collisions subcollection
  for (const c of commitments) {
    const collision = collisions.find(col => col.commitmentId === c.id);
    const hasCollision = !!collision;
    const collisionDetails = collision ? collision.conflictDetails : null;
    const collidingCommitmentIds = collision ? collision.collidingCommitmentIds : [];

    // Update commitment document
    await adminDb.collection("users").doc(userId).collection("commitments").doc(c.id).update({
      hasCollision,
      collisionDetails,
      collidingCommitmentIds,
      collisionUpdatedAt: FieldValue.serverTimestamp()
    });

    // Write subcollection entry if there is a collision
    if (collision) {
      await collisionsColRef.add({
        commitmentId: c.id,
        title: c.title,
        conflictType: collision.conflictType,
        conflictDetails: collision.conflictDetails,
        collidingCommitmentIds: collision.collidingCommitmentIds,
        detectedAt: FieldValue.serverTimestamp()
      });
    }
  }
}
