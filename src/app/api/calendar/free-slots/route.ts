import { NextRequest, NextResponse } from "next/server";
import { getCalendarFreeSlots } from "@/lib/backend/calendar";
import { z } from "zod";

const QuerySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  days: z.preprocess((val) => Number(val), z.number().int().min(1).max(30).default(7)),
});

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const result = QuerySchema.safeParse({
      userId: searchParams.get("userId"),
      days: searchParams.get("days"),
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { userId, days } = result.data;
    const slots = await getCalendarFreeSlots(userId, { days });
    return NextResponse.json({ slots });
  } catch (error: any) {
    console.error("GET /api/calendar/free-slots error:", error);
    const statusCode = error.code === "CALENDAR_UNAVAILABLE" ? 503 : 500;
    return NextResponse.json(
      { error: error.message || "Failed to fetch free slots" },
      { status: statusCode }
    );
  }
}
