import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebaseAdmin";
import { encrypt } from "@/lib/auth/tokenEncryption";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { userId, calendarRefreshToken, gmailRefreshToken, email, displayName, photoURL } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    // Verify ownership: Firebase ID token matching userId
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (decoded.uid !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updates: Record<string, any> = {};
    if (calendarRefreshToken !== undefined) {
      updates.googleCalendarRefreshToken = encrypt(calendarRefreshToken);
    }
    if (gmailRefreshToken !== undefined) {
      updates.googleGmailRefreshToken = encrypt(gmailRefreshToken);
    }
    if (email) {
      updates.email = email;
    }
    if (displayName) {
      updates.displayName = displayName;
    }
    if (photoURL) {
      updates.photoURL = photoURL;
    }

    await adminDb.collection("users").doc(userId).set(updates, { merge: true });
    
    return NextResponse.json({ status: "saved" });
  } catch (error: any) {
    console.error("Error in save-tokens POST:", error.message);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
