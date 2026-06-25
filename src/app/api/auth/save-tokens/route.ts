import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { encrypt } from "@/lib/auth/tokenEncryption";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      uid,
      email,
      displayName,
      photoURL,
      accessToken,
      refreshToken,
      tokenExpiry,
    } = body;

    if (!uid) {
      return NextResponse.json({ error: "Missing uid" }, { status: 400 });
    }

    const encryptedAccessToken = accessToken ? encrypt(accessToken) : "";
    const encryptedRefreshToken = refreshToken ? encrypt(refreshToken) : "";

    let expiryTimestamp: Timestamp;
    if (tokenExpiry) {
      const ms = typeof tokenExpiry === "number" && tokenExpiry < 1000000000000
        ? tokenExpiry * 1000
        : tokenExpiry;
      expiryTimestamp = Timestamp.fromMillis(ms);
    } else {
      expiryTimestamp = Timestamp.fromMillis(Date.now() + 3600 * 1000);
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userDoc = await userRef.get();
    const now = Timestamp.now();

    const userData: any = {
      uid,
      email: email || "",
      displayName: displayName || "",
      photoURL: photoURL || "",
      lastActiveAt: now,
      updatedAt: now,
    };

    if (encryptedAccessToken) {
      userData.googleAccessToken = encryptedAccessToken;
      userData.tokenExpiry = expiryTimestamp;
    }
    if (encryptedRefreshToken) {
      userData.googleRefreshToken = encryptedRefreshToken;
    }

    if (!userDoc.exists) {
      userData.createdAt = now;
      userData.preferences = {
        defaultDomain: "personal",
        workingHours: { start: 9, end: 18 },
        theme: "system",
        notificationsEnabled: true,
        fcmToken: "",
      };
      userData.learningCoefficients = {
        underestimationFactor: 1.0,
        preferredWorkHours: [9, 10, 14, 15, 20, 21],
        avgProcrastinationBuffer: 2.0,
        lastUpdated: now,
      };
      userData.stats = {
        totalCommitmentsCreated: 0,
        totalCompleted: 0,
        totalMissed: 0,
        currentStreak: 0,
        longestStreak: 0,
        stressScore: 0,
        stressScoreComputedAt: now,
      };
      await userRef.set(userData);
    } else {
      await userRef.update(userData);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in save-tokens:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
