import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { callGemini } from "@/lib/ai/gemini";
import { buildWeeklyPlanningPrompt } from "@/lib/ai/prompts/weeklyPlanning";
import { weeklyPlanResponseSchema } from "@/lib/ai/schemas/weeklyPlan";
import { applyConfidenceAwareness } from "@/lib/ai/confidence";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { startOfWeek, format } from "date-fns";
import { z } from "zod";

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

    // 1. Check for cached plan
    const cachedDoc = await adminDb
      .collection("users")
      .doc(userId)
      .collection("weeklyPlans")
      .doc(weekId)
      .get();

    if (cachedDoc.exists) {
      const cachedData = cachedDoc.data();
      if (cachedData) {
        const generatedAt = cachedData.generatedAt?.toDate?.() || new Date(cachedData.generatedAt);
        const ageMs = Date.now() - generatedAt.getTime();
        
        // If cached plan is less than 24 hours old, return it
        if (ageMs < 24 * 60 * 60 * 1000) {
          return NextResponse.json({
            ...cachedData.plan,
            fromCache: true,
          });
        }
      }
    }

    // 2. Fetch fresh Extended Context
    const extendedContext = await ensureFreshContext(userId, "extended");

    const systemInstruction =
      "You are FinishLine's expert weekly planning coach. Analyze the user's Extended Life Context and design a structured, realistic plan for the upcoming week.";
    const prompt = buildWeeklyPlanningPrompt(extendedContext as any);

    // 3. Invoke Gemini
    const planResult = await callGemini({
      systemInstruction,
      prompt,
      schema: weeklyPlanResponseSchema,
      endpointType: "weekly-planning",
    });

    // 4. Apply confidence awareness
    const enrichedResult = applyConfidenceAwareness(planResult);

    // 5. Cache the new plan in Firestore
    await adminDb
      .collection("users")
      .doc(userId)
      .collection("weeklyPlans")
      .doc(weekId)
      .set({
        weekStart: weekId,
        plan: enrichedResult,
        generatedAt: Timestamp.now(),
      });

    return NextResponse.json({
      ...enrichedResult,
      fromCache: false,
    });
  } catch (error: any) {
    console.error("POST /api/ai/weekly-planning error:", error);
    return NextResponse.json(
      { error: "WEEKLY_PLANNING_FAILED", message: error.message || "Failed to generate weekly plan" },
      { status: 500 }
    );
  }
}
