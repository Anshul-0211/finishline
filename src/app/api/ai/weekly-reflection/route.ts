import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { callGemini } from "@/lib/ai/gemini";
import { buildWeeklyReflectionPrompt } from "@/lib/ai/prompts/weeklyReflection";
import { weeklyReflectionResponseSchema } from "@/lib/ai/schemas/weeklyReflection";
import { applyConfidenceAwareness } from "@/lib/ai/confidence";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { startOfWeek, format } from "date-fns";
import { z } from "zod";
import { ExtendedLifeContext } from "@/lib/ai/types";

const RequestSchema = z.object({
  userId: z.string().min(1, "userId is required"),
});

function getMondayISO(): string {
  const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
  return format(mon, "yyyy-MM-dd");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { userId } = parseResult.data;
    const weekId = getMondayISO();

    // 1. Cache Check: Return existing reflection for this week if it exists
    const cachedDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("reflections")
      .doc(weekId)
      .get();

    if (cachedDoc.exists) {
      const cachedData = cachedDoc.data();
      if (cachedData) {
        return NextResponse.json({
          ...cachedData.reflection,
          fromCache: true,
        });
      }
    }

    // 2. Fetch fresh Extended Context
    const extendedContext = (await ensureFreshContext(userId, "extended")) as ExtendedLifeContext;

    // 3. Activity Gate: Require at least 1 completed commitment
    const completedCount = extendedContext.pastWeek?.completedCommitments?.length || 0;
    if (completedCount === 0) {
      return NextResponse.json(
        {
          error: "INSUFFICIENT_DATA",
          message: "Complete at least one commitment step this week before reflecting.",
        },
        { status: 400 }
      );
    }

    const systemInstruction =
      "You are FinishLine's empathetic weekly reflection coach. Analyze the user's past week performance and generate a meaningful reflection.";
    const prompt = buildWeeklyReflectionPrompt(extendedContext as any);

    // 4. Invoke Gemini
    const reflectionResult = await callGemini({
      systemInstruction,
      prompt,
      schema: weeklyReflectionResponseSchema,
      endpointType: "weekly-reflection",
    });

    // 5. Apply confidence awareness
    const enrichedResult = applyConfidenceAwareness(reflectionResult);

    // 6. Save reflection and update user doc
    const batch = adminDb.batch();
    
    const reflectionRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("reflections")
      .doc(weekId);
    
    batch.set(reflectionRef, {
      weekStart: weekId,
      reflection: enrichedResult,
      generatedAt: Timestamp.now(),
    });

    const userRef = adminDb.collection("users").doc(userId);
    batch.update(userRef, {
      lastReflectionGeneratedAt: Timestamp.now(),
    });

    await batch.commit();

    return NextResponse.json({
      ...enrichedResult,
      fromCache: false,
    });
  } catch (error: any) {
    console.error("POST /api/ai/weekly-reflection error:", error);
    return NextResponse.json(
      { error: "WEEKLY_REFLECTION_FAILED", message: error.message || "Failed to generate weekly reflection" },
      { status: 500 }
    );
  }
}
