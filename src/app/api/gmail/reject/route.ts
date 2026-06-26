import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

const RequestSchema = z.object({
  suggestionId: z.string().min(1, "suggestionId is required"),
  userId: z.string().min(1, "userId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { suggestionId, userId } = parseResult.data;
    const now = Timestamp.now();

    const suggestionRef = adminDb.collection("gmailSuggestions").doc(suggestionId);
    const doc = await suggestionRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    const suggestion = doc.data() as any;
    if (suggestion.status !== "pending") {
      return NextResponse.json({ error: "Suggestion is already processed" }, { status: 400 });
    }

    await suggestionRef.update({
      status: "rejected",
      updatedAt: now,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("POST /api/gmail/reject error:", error);
    return NextResponse.json(
      { error: "REJECT_FAILED", message: error.message || "Failed to reject Gmail suggestion" },
      { status: 500 }
    );
  }
}
