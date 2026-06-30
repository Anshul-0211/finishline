import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { processCollisions } from "@/lib/services/agent/collide";
import { processUserRisk } from "@/lib/services/agent/risk";
import { firestoreToCommitment } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
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

    // 1. Fetch user doc
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: `User ${userId} not found` }, { status: 404 });
    }

    const userData = userDoc.data() || {};
    const user = {
      uid: userId,
      email: userData.email || "",
      displayName: userData.displayName || "",
      photoURL: userData.photoURL || "",
      googleCalendarRefreshToken: userData.googleCalendarRefreshToken,
      googleGmailRefreshToken: userData.googleGmailRefreshToken,
      googleCalendarId: userData.googleCalendarId,
      fcmToken: userData.fcmToken,
      preferences: userData.preferences,
      learningCoefficients: userData.learningCoefficients,
      stats: userData.stats,
    } as any;

    // 2. Fetch active/renegotiating commitments
    const commitmentsSnap = await adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .get();

    const commitments = commitmentsSnap.docs.map((doc: any) => firestoreToCommitment(doc as any));

    // 3. Update calendarLastFetchedAt on user profile
    await adminDb.collection("users").doc(userId).update({
      calendarLastFetchedAt: FieldValue.serverTimestamp(),
    });

    // 4. Run the deterministic collision engine & process collisions
    console.log(`[calendar-sync] Processing collisions for user: ${userId}...`);
    await processCollisions(userId, commitments);

    // 5. Re-evaluate risks and stress scores
    console.log(`[calendar-sync] Re-evaluating risk for user: ${userId}...`);
    await processUserRisk(user, commitments);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[calendar-sync] Critical error during calendar sync:", msg);
    return NextResponse.json({ error: "Calendar sync failed", details: msg }, { status: 500 });
  }
}
