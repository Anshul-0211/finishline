import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGemini } from "@/lib/ai/gemini";
import { WeeklyReflectionSchema } from "@/lib/ai/schemas/weeklyReflection";
import { buildWeeklyReflectionPrompt, WEEKLY_REFLECTION_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/weeklyReflection";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { ExtendedLifeContext } from "@/lib/ai/types";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    // 1. Assemble Extended Life Context (with freshness check)
    console.log(`[weekly-reflection] Fetching fresh ExtendedLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "extended");

    // 2. Build prompt
    const prompt = buildWeeklyReflectionPrompt(context as ExtendedLifeContext);

    // 3. Invoke Gemini
    console.log("[weekly-reflection] Calling Gemini for weekly reflection...");
    const rawResult = await callGemini<any>({
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

    // 6. Update user's lastReflectionGeneratedAt timestamp in Firestore
    console.log("[weekly-reflection] Updating lastReflectionGeneratedAt timestamp in Firestore...");
    await adminDb.collection("users").doc(userId).update({
      lastReflectionGeneratedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[weekly-reflection] Critical error generating weekly reflection:", msg);
    return NextResponse.json({ error: "Weekly reflection failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
