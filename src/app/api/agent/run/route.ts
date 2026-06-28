import { NextRequest, NextResponse } from "next/server";
import { getAllActiveUsers, getActiveCommitmentsForUser } from "@/lib/services/agent/scan";
import { processUserRisk } from "@/lib/services/agent/risk";
import { processCollisions, detectCollisions } from "@/lib/services/agent/collide";
import { processCheckIns } from "@/lib/services/agent/checkin";
import { processResurface } from "@/lib/services/agent/resurface";
import { shouldRunPatternLearner, runPatternLearner } from "@/lib/services/agent/patternLearner";
import { logAgentRun } from "@/lib/services/agent/log";

function authorize(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7);
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    console.warn("[Cron Agent] CRON_SECRET is not configured in the environment.");
    return false;
  }
  return token === cronSecret;
}

async function handleRun(req: NextRequest): Promise<NextResponse> {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[Cron Agent] Starting autonomous agent loop run...");

  let totalCommitmentsProcessed = 0;
  let usersProcessed = 0;
  let totalCollisionsDetected = 0;
  let totalCheckInsSent = 0;
  const allErrors: string[] = [];

  try {
    const users = await getAllActiveUsers();
    const forceDaily = req.nextUrl.searchParams.get("forceDaily") === "true";

    for (const user of users) {
      try {
        const commitments = await getActiveCommitmentsForUser(user.uid);
        
        // 1. RISK step
        const { commitmentsProcessed, errors: riskErrors } = await processUserRisk(user, commitments);
        totalCommitmentsProcessed += commitmentsProcessed;
        if (riskErrors.length > 0) {
          allErrors.push(...riskErrors);
        }

        // 2. COLLIDE step
        try {
          // Detect collisions count
          const detected = await detectCollisions(user.uid, commitments);
          totalCollisionsDetected += detected.length;

          // Run collision persistence
          await processCollisions(user.uid, commitments);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          allErrors.push(`Failed COLLIDE step for user ${user.uid}: ${msg}`);
        }

        // 3. CHECKIN step
        try {
          const checkInsSent = await processCheckIns(user, commitments);
          totalCheckInsSent += checkInsSent;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          allErrors.push(`Failed CHECKIN step for user ${user.uid}: ${msg}`);
        }

        // 4. RESURFACE step
        try {
          await processResurface(user.uid, commitments);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          allErrors.push(`Failed RESURFACE step for user ${user.uid}: ${msg}`);
        }

        // 5. Pattern Learner step (daily only)
        if (shouldRunPatternLearner() || forceDaily) {
          try {
            await runPatternLearner(user.uid, user);
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            allErrors.push(`Failed Pattern Learner step for user ${user.uid}: ${msg}`);
          }
        }

        usersProcessed++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        allErrors.push(`Failed to process agent run for user ${user.uid}: ${msg}`);
      }
    }

    // 6. LOG step
    await logAgentRun({
      usersProcessed,
      commitmentsProcessed: totalCommitmentsProcessed,
      collisionsDetected: totalCollisionsDetected,
      checkInsSent: totalCheckInsSent,
      errors: allErrors
    });

    console.log(`[Cron Agent] Run finished. Users: ${usersProcessed}, Commitments: ${totalCommitmentsProcessed}, Collisions: ${totalCollisionsDetected}, CheckIns: ${totalCheckInsSent}, Errors: ${allErrors.length}`);

    return NextResponse.json({
      usersProcessed,
      commitmentsProcessed: totalCommitmentsProcessed,
      collisionsDetected: totalCollisionsDetected,
      checkInsSent: totalCheckInsSent,
      errors: allErrors
    }, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Cron Agent] Run failed with critical error:", msg);
    
    // Attempt to log critical failure
    await logAgentRun({
      usersProcessed,
      commitmentsProcessed: totalCommitmentsProcessed,
      collisionsDetected: totalCollisionsDetected,
      checkInsSent: totalCheckInsSent,
      errors: [...allErrors, `Critical agent failure: ${msg}`]
    });

    return NextResponse.json({ error: "Internal Server Error", details: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return handleRun(req);
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handleRun(req);
}

export const dynamic = "force-dynamic";
