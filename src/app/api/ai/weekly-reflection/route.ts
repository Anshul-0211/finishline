import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGateway } from "@/lib/ai/gateway";
import { WeeklyReflectionSchema } from "@/lib/ai/schemas/weeklyReflection";
import { buildWeeklyReflectionPrompt, WEEKLY_REFLECTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/weeklyReflection";
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

    // 1. Assemble Extended Life Context (with freshness check)
    console.log(`[weekly-reflection] Fetching fresh ExtendedLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "extended");

    // 2. Build prompt
    const prompt = buildWeeklyReflectionPrompt(context as ExtendedLifeContext);

    // 3. Invoke Gateway
    console.log("[weekly-reflection] Calling Gateway for weekly reflection...");
    const rawResult = await callGateway<any>({
      systemInstruction: WEEKLY_REFLECTION_SYSTEM_INSTRUCTION,
      prompt,
      schema: WeeklyReflectionSchema as any,
      endpointType: "weekly-reflection",
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

    // 6. Update user's reflection cache in Firestore
    console.log("[weekly-reflection] Caching weekly reflection and updating timestamp in Firestore...");
    await adminDb.collection("users").doc(userId).update({
      lastWeeklyReflection: finalResult,
      lastWeeklyReflectionGeneratedAt: FieldValue.serverTimestamp(),
      lastReflectionGeneratedAt: FieldValue.serverTimestamp(),
    }).catch((e: any) => console.warn("[weekly-reflection] Caching failed:", e.message));

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[weekly-reflection] Critical error generating weekly reflection:", msg);
    return NextResponse.json({ error: "Weekly reflection failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
