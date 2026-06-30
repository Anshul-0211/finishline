import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/services/calendar";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, adjustments } = await req.json();
    if (!userId || !adjustments || !Array.isArray(adjustments)) {
      return NextResponse.json({ error: "Missing required fields: userId, adjustments" }, { status: 400 });
    }

    // Verify ownership
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      if (decoded.uid !== userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } catch (e) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[reallocate-blocks] Processing ${adjustments.length} calendar adjustments for user ${userId}`);

    for (const adj of adjustments) {
      const { commitmentId, originalBlock, proposedBlock } = adj;
      if (!commitmentId || !originalBlock || !proposedBlock) {
        console.warn("[reallocate-blocks] Skipping malformed adjustment:", adj);
        continue;
      }

      // Fetch Firestore commitment document
      const commitmentRef = adminDb
        .collection("users")
        .doc(userId)
        .collection("commitments")
        .doc(commitmentId);

      const commitmentSnap = await commitmentRef.get();
      if (!commitmentSnap.exists) {
        console.warn(`[reallocate-blocks] Commitment ${commitmentId} not found, skipping.`);
        continue;
      }

      const commitmentData = commitmentSnap.data()!;
      const scheduledBlocks: any[] = commitmentData.scheduledBlocks || [];
      const calendarEventIds: string[] = commitmentData.calendarEventIds || [];

      // Find original block
      const originalBlockIdx = scheduledBlocks.findIndex(
        (b) => b.start === originalBlock.start && b.end === originalBlock.end
      );

      const oldBlock = originalBlockIdx !== -1 ? scheduledBlocks[originalBlockIdx] : null;
      const oldEventId = oldBlock?.calendarEventId;

      // 1. Delete old Google Calendar event if it exists
      if (oldEventId) {
        console.log(`[reallocate-blocks] Deleting old event ${oldEventId} on Google Calendar`);
        await deleteCalendarEvent(userId, oldEventId).catch((e: any) =>
          console.warn(`[reallocate-blocks] Failed to delete event ${oldEventId}:`, e.message)
        );
      }

      // 2. Create new Google Calendar event
      let newEventId = "";
      try {
        const newEvent = {
          summary: `[FinishLine] ${commitmentData.title}`,
          description: `Scheduled work block for commitment: "${commitmentData.title}"\nCommitment ID: ${commitmentId}`,
          start: {
            dateTime: new Date(proposedBlock.start).toISOString(),
          },
          end: {
            dateTime: new Date(proposedBlock.end).toISOString(),
          },
        };
        console.log(`[reallocate-blocks] Creating new event on Google Calendar for proposed block`);
        const createdId = await createCalendarEvent(userId, newEvent);
        newEventId = createdId || "";
      } catch (err: any) {
        console.warn("[reallocate-blocks] Failed to create new event, fallback to local-only update:", err.message);
      }

      // 3. Update scheduledBlocks list
      if (originalBlockIdx !== -1) {
        scheduledBlocks[originalBlockIdx] = {
          start: proposedBlock.start,
          end: proposedBlock.end,
          calendarEventId: newEventId || null
        };
      } else {
        scheduledBlocks.push({
          start: proposedBlock.start,
          end: proposedBlock.end,
          calendarEventId: newEventId || null
        });
      }

      // 4. Update calendarEventIds list
      if (oldEventId) {
        const eventIdx = calendarEventIds.indexOf(oldEventId);
        if (eventIdx !== -1) {
          if (newEventId) {
            calendarEventIds[eventIdx] = newEventId;
          } else {
            calendarEventIds.splice(eventIdx, 1);
          }
        } else if (newEventId) {
          calendarEventIds.push(newEventId);
        }
      } else if (newEventId) {
        calendarEventIds.push(newEventId);
      }

      // 5. Update Firestore document
      await commitmentRef.update({
        scheduledBlocks,
        calendarEventIds
      });
      console.log(`[reallocate-blocks] Successfully updated commitment ${commitmentId} in Firestore`);
    }

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[reallocate-blocks] Critical error reallocating blocks:", msg);
    return NextResponse.json({ error: "Failed to reallocate blocks", details: msg }, { status: 500 });
  }
}
