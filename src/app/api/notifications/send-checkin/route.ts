import { NextRequest, NextResponse } from "next/server";
import { sendCheckInNotification } from "@/lib/backend/notifications";
import { adminDb } from "@/lib/firebase/admin";
import { z } from "zod";

const BodySchema = z.object({
  userId: z.string().min(1, "userId is required"),
  commitmentId: z.string().min(1, "commitmentId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = BodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const { userId, commitmentId } = result.data;

    // Load commitment details from Firestore
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId);
    
    const commitmentDoc = await commitmentRef.get();

    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const commitmentData = commitmentDoc.data();
    if (!commitmentData) {
      return NextResponse.json({ error: "Commitment data is empty" }, { status: 404 });
    }

    await sendCheckInNotification(userId, {
      id: commitmentId,
      title: commitmentData.title || "Untitled Commitment",
      riskScore: commitmentData.riskScore || 0,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/notifications/send-checkin error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send check-in notification" },
      { status: 500 }
    );
  }
}
