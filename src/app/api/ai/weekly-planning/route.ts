import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGateway } from "@/lib/ai/gateway";
import { WeeklyPlanSchema } from "@/lib/ai/schemas/weeklyPlan";
import { buildWeeklyPlanningPrompt, WEEKLY_PLANNING_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/weeklyPlanning";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { ExtendedLifeContext } from "@/lib/ai/types";
import { verifyAuth } from "@/lib/auth/authVerification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // Verify authentication and ownership
    await verifyAuth(req, userId);

    // 1. Assemble Extended Life Context (with freshness checks)
    console.log(`[weekly-planning] Fetching fresh ExtendedLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "extended");

    // 2. Build prompt
    const prompt = buildWeeklyPlanningPrompt(context as ExtendedLifeContext);

    // 3. Invoke Gateway
    console.log("[weekly-planning] Calling Gateway for weekly planning...");
    const rawResult = await callGateway<any>({
      systemInstruction: WEEKLY_PLANNING_SYSTEM_INSTRUCTION,
      prompt,
      schema: WeeklyPlanSchema as any,
      endpointType: "weekly-planning",
    });

    // 4. Enrich with confidence metadata
    const enrichedResult = applyConfidenceAwareness(rawResult);

    // 5. Ensure confidenceLabel is present under aiMeta
    const finalResult = {
      ...enrichedResult,
      aiMeta: {
        ...enrichedResult.aiMeta,
        confidenceLabel: deriveConfidenceLabel(enrichedResult.aiMeta.confidence),
      },
    };

    // 6. Cache the result on the user document in Firestore
    console.log("[weekly-planning] Caching generated weekly plan in Firestore...");
    await adminDb.collection("users").doc(userId).update({
      lastWeeklyPlan: finalResult,
      lastWeeklyPlanGeneratedAt: FieldValue.serverTimestamp(),
    }).catch((e: any) => console.warn("[weekly-planning] Caching failed:", e.message));

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[weekly-planning] Critical error generating weekly plan:", msg);
    return NextResponse.json({ error: "Weekly planning failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
