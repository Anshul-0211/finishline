import { NextRequest, NextResponse } from "next/server";
import { writeCalendarBlock } from "@/lib/backend/calendar";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const BodySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  commitmentId: z.string().min(1, "commitmentId is required"),
  title: z.string().min(1, "title is required"),
  start: z.string().min(1, "start is required"), // ISO string
  end: z.string().min(1, "end is required"),     // ISO string
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = BodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { userId, commitmentId, title, start, end, description } = result.data;

    // Write event to Google Calendar
    const calendarEventId = await writeCalendarBlock(userId, {
      title,
      start,
      end,
      description,
      commitmentId,
    });

    // Write back to Firestore commitment doc
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId);

    const blockData = {
      title,
      start,
      end,
      calendarEventId,
    };

    await commitmentRef.update({
      calendarBlocks: FieldValue.arrayUnion(blockData),
      scheduledBlocks: FieldValue.arrayUnion({
        start,
        end,
        calendarEventId,
      }),
      calendarSyncStatus: "synced",
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ calendarEventId });
  } catch (error: any) {
    console.error("POST /api/calendar/write-block error:", error);
    const statusCode = error.code === "CALENDAR_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to write calendar block" },
      { status: statusCode }
    );
  }
}
