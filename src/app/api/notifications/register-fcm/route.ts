import { NextRequest, NextResponse } from "next/server";
import { registerFCMToken } from "@/lib/backend/notifications";
import { z } from "zod";

const BodySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  token: z.string().min(1, "token is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = BodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { userId, token } = result.data;
    await registerFCMToken(userId, token);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/notifications/register-fcm error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to register FCM token" },
      { status: 500 }
    );
  }
}
