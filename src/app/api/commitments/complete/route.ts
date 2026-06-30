import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { deleteCalendarEvent } from "@/lib/services/calendar";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Verify JWT authorization header
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(idToken);
    } catch (err: any) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = decoded.uid;

    // 2. Extract commitment ID (support both query parameter and json body)
    const url = new URL(req.url);
    let commitmentId = url.searchParams.get("id");

    if (!commitmentId) {
      try {
        const body = await req.json();
        commitmentId = body.commitmentId || body.id;
      } catch (e) {
        // Body reading failed, ignoring since we might have query params
      }
    }

    if (!commitmentId) {
      return NextResponse.json({ error: "Missing commitment ID" }, { status: 400 });
    }

    console.log(`[Complete API] Marking commitment ${commitmentId} as completed for user ${userId}...`);

    // 3. Retrieve commitment from Firestore
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId);

    const docSnap = await commitmentRef.get();
    if (!docSnap.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const commitment = docSnap.data()!;

    // 4. Update the commitment status in Firestore
    await commitmentRef.update({
      status: "completed",
      completionPercentage: 100,
      completedAt: FieldValue.serverTimestamp(),
      isDirty: true,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log(`[Complete API] Updated Firestore document status to 'completed' for commitment ${commitmentId}`);

    // 5. Delete corresponding calendar events from Google Calendar
    const calendarEventIds: string[] = commitment.calendarEventIds || [];
    if (calendarEventIds.length > 0) {
      console.log(`[Complete API] Deleting ${calendarEventIds.length} Google Calendar event(s) for user ${userId}...`);
      for (const eventId of calendarEventIds) {
        try {
          await deleteCalendarEvent(userId, eventId);
        } catch (calErr: any) {
          console.warn(`[Complete API] Failed to delete calendar event ${eventId}: ${calErr.message}. Continuing.`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Commitment "${commitment.title}" successfully completed!`,
      commitmentId,
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Complete API] Error marking commitment as complete: ${msg}`);
    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}
