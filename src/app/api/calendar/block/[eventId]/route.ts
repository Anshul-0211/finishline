import { NextRequest, NextResponse } from "next/server";
import { deleteCalendarBlock } from "@/lib/backend/calendar";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ eventId: string }>;
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { eventId } = await params;
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    if (!eventId) {
      return NextResponse.json({ error: "eventId is required" }, { status: 400 });
    }

    // Call calendar deletion
    await deleteCalendarBlock(userId, eventId);

    // Find and update Firestore commitment doc
    const commitmentsSnapshot = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .get();

    for (const doc of commitmentsSnapshot.docs) {
      const data = doc.data();
      const blocks = data.calendarBlocks || [];
      const found = blocks.find((b: any) => b.calendarEventId === eventId);
      if (found) {
        const schedBlocks = data.scheduledBlocks || [];
        const foundSched = schedBlocks.find((b: any) => b.calendarEventId === eventId);
        
        const updates: any = {
          calendarBlocks: FieldValue.arrayRemove(found),
          updatedAt: FieldValue.serverTimestamp(),
        };
        
        if (foundSched) {
          updates.scheduledBlocks = FieldValue.arrayRemove(foundSched);
        }
        
        await doc.ref.update(updates);
        break;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/calendar/block/[eventId] error:", error);
    const statusCode = error.code === "CALENDAR_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to delete calendar block" },
      { status: statusCode }
    );
  }
}
