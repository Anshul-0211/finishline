import { NextRequest, NextResponse } from "next/server";
import { writeCommitmentBlocks } from "@/lib/services/calendar";
import { adminAuth } from "@/lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const idToken = authHeader?.replace("Bearer ", "");
    if (!idToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, commitmentId, blocks } = await req.json();
    if (!userId || !commitmentId || !blocks) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
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

    console.log(`[write-blocks] Writing ${blocks.length} blocks for commitment ${commitmentId} and user ${userId}`);
    const eventIds = await writeCommitmentBlocks(userId, commitmentId, blocks);
    return NextResponse.json({ success: true, eventIds }, { status: 200 });
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[write-blocks] Failed to write commitment blocks:", msg);
    return NextResponse.json({ error: "Failed to write commitment blocks", details: msg }, { status: 500 });
  }
}
