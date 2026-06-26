import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { deleteCalendarBlock } from "@/lib/backend/calendar";
import { Timestamp } from "firebase-admin/firestore";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const userId = req.cookies.get("session")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const doc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(id)
      .get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const data = doc.data();

    // Serialize Timestamp fields
    const serialized = {
      ...data,
      createdAt: data?.createdAt?.toDate?.()?.toISOString() || data?.createdAt,
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString() || data?.updatedAt,
      deadline: data?.deadline?.toDate?.()?.toISOString() || data?.deadline || null,
      nextCheckInAt: data?.nextCheckInAt?.toDate?.()?.toISOString() || data?.nextCheckInAt || null,
      lastCheckInAt: data?.lastCheckInAt?.toDate?.()?.toISOString() || data?.lastCheckInAt || null,
    };

    return NextResponse.json(serialized);
  } catch (error: any) {
    console.error(`GET /api/commitments/[id] error:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch commitment" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const userId = req.cookies.get("session")?.value;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ref = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(id);

    const doc = await ref.get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const data = doc.data();
    const calendarBlocks = data?.calendarBlocks || [];

    // Delete calendar blocks
    for (const block of calendarBlocks) {
      if (block.calendarEventId) {
        try {
          await deleteCalendarBlock(userId, block.calendarEventId);
        } catch (calErr) {
          console.error(`Failed to delete calendar block ${block.calendarEventId}:`, calErr);
        }
      }
    }

    const now = Timestamp.now();
    await ref.update({
      status: "cancelled",
      cancelledAt: now,
      calendarBlocks: [],
      scheduledBlocks: [],
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(`DELETE /api/commitments/[id] error:`, error);
    return NextResponse.json(
      { error: error.message || "Failed to delete commitment" },
      { status: 500 }
    );
  }
}
