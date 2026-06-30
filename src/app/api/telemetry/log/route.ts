import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth/authVerification";
import { writeFocusEvent } from "@/lib/telemetry";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const decoded = await verifyAuth(req);
    const userId = decoded.uid;

    const body = await req.json();
    const { 
      commitmentId, 
      eventType, 
      durationSeconds, 
      uninterruptedFocusMinutes,
      startTime,
      endTime,
      terminationState,
      timestamp
    } = body;

    // Validate request body
    if (!commitmentId || !eventType) {
      return NextResponse.json({ error: "Missing commitmentId or eventType" }, { status: 400 });
    }

    // Default formatting / fallbacks
    const eventTime = timestamp || new Date().toISOString();
    const sessionStartTime = startTime || eventTime;
    const sessionEndTime = endTime || (['start', 'resume'].includes(eventType) ? null : eventTime);
    const termState = terminationState || (eventType === 'complete' ? 'completed' : eventType === 'pause' ? 'paused' : 'abandoned');

    const logId = await writeFocusEvent(userId, {
      commitmentId,
      startTime: sessionStartTime,
      endTime: sessionEndTime,
      eventType,
      durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : 0,
      uninterruptedFocusMinutes: typeof uninterruptedFocusMinutes === 'number' ? uninterruptedFocusMinutes : 0,
      terminationState: termState,
      timestamp: eventTime
    });

    return NextResponse.json({ success: true, logId }, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[telemetry-log] Failed to log telemetry:", msg);
    return NextResponse.json({ error: "Failed to log telemetry", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
