import { NextRequest, NextResponse } from "next/server";
import { generateActionPlan } from "@/lib/ai/actions/generateActionPlan";
import { z } from "zod";

const RequestSchema = z.object({
  commitmentId: z.string().min(1, "commitmentId is required"),
  userId: z.string().min(1, "userId is required"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { commitmentId, userId } = parseResult.data;

    const actionPlan = await generateActionPlan(userId, commitmentId);
    return NextResponse.json(actionPlan);
  } catch (error: any) {
    console.error("POST /api/ai/generate-action-plan error:", error);
    return NextResponse.json(
      { error: "GENERATION_FAILED", message: error.message || "Failed to generate action plan" },
      { status: 500 }
    );
  }
}
