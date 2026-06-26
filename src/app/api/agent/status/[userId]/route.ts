import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

interface RouteContext {
  params: Promise<{ userId: string }>;
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await params;
    const cookieUserId = req.cookies.get("session")?.value;

    if (!cookieUserId || cookieUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const agentLogsRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("agentLogs");

    const snapshot = await agentLogsRef
      .orderBy("runAt", "desc")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(null);
    }

    const logDoc = snapshot.docs[0];
    const logData = logDoc.data();

    // Map fields as expected by Task 5
    const result = {
      lastRunAt: logData.runAt ? (typeof logData.runAt.toDate === "function" ? logData.runAt.toDate().toISOString() : new Date(logData.runAt).toISOString()) : null,
      commitmentCount: logData.commitmentCount || 0,
      risksUpdated: logData.risksUpdated || 0,
      collisionsDetected: logData.collisionsDetected || 0,
      checkInsSent: logData.checkInsSent || 0,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("GET /api/agent/status/[userId] error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch agent status" },
      { status: 500 }
    );
  }
}
