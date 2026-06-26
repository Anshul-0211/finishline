import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { commitmentDraftSchema } from "@/lib/ai/schemas/commitmentDraft";
import { replanOnAdd } from "@/lib/backend/replanOnAdd";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {
  try {
    const userId = req.cookies.get("session")?.value;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const result = commitmentDraftSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.issues[0].message }, { status: 400 });
    }

    const draft = result.data;
    const now = Timestamp.now();

    // Map deadline string to Firestore Timestamp
    const deadlineTimestamp = draft.deadline ? Timestamp.fromDate(new Date(draft.deadline)) : null;

    // Create commitment document
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc();

    const commitmentData = {
      id: commitmentRef.id,
      title: draft.title,
      description: draft.description || "",
      domain: draft.domain,
      status: "active",
      priority: draft.priority,
      deadline: deadlineTimestamp,
      effortEstimateHours: draft.effortEstimateHours,
      adjustedEffortHours: draft.effortEstimateHours, // replanOnAdd will adjust based on coefficients
      completedEffortHours: 0,
      completionPercentage: 0,
      riskScore: 0,
      riskTrend: "stable",
      probabilityCurrentPath: 100,
      probabilityRecommendedPath: 100,
      source: (body.source as any) || "manual",
      sourceFileUrl: body.sourceFileUrl || null,
      gmailMessageId: body.gmailMessageId || null,
      actionPlan: null,
      calendarEventIds: [],
      scheduledBlocks: [],
      calendarBlocks: [],
      nextCheckInAt: null,
      lastCheckInAt: null,
      checkInHistory: [],
      isLongTermGoal: draft.isLongTermGoal || false,
      lastResurfacedAt: null,
      tags: body.tags || [],
      createdAt: now,
      updatedAt: now,
      extractedByAI: body.extractedByAI || false,
      extractionConfidence: draft.confidence || 0,
    };

    await commitmentRef.set(commitmentData);

    // Trigger Replan-on-Add
    let replanResult = null;
    try {
      replanResult = await replanOnAdd(userId, commitmentRef.id);
    } catch (replanErr: any) {
      console.error(`Replan failed for commitment ${commitmentRef.id}:`, replanErr);
      // Do not fail the whole request, but report the error
      replanResult = { error: replanErr.message || "Replan failed" };
    }

    // Fetch the updated commitment with action plan and blocks
    const updatedDoc = await commitmentRef.get();
    const updatedData = updatedDoc.data();

    // Serialize Timestamp fields for JSON response
    const serializedCommitment = {
      ...updatedData,
      createdAt: updatedData?.createdAt?.toDate().toISOString(),
      updatedAt: updatedData?.updatedAt?.toDate().toISOString(),
      deadline: updatedData?.deadline?.toDate().toISOString() || null,
      nextCheckInAt: updatedData?.nextCheckInAt?.toDate().toISOString() || null,
      lastCheckInAt: updatedData?.lastCheckInAt?.toDate().toISOString() || null,
    };

    return NextResponse.json({
      commitment: serializedCommitment,
      replanResult,
    });
  } catch (error: any) {
    console.error("POST /api/commitments/create error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create commitment" },
      { status: 500 }
    );
  }
}
