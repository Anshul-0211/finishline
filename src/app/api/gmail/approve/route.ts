import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { replanOnAdd } from "@/lib/backend/replanOnAdd";
import { Timestamp } from "firebase-admin/firestore";
import { z } from "zod";

const RequestSchema = z.object({
  suggestionId: z.string().min(1, "suggestionId is required"),
  userId: z.string().min(1, "userId is required"),
  overrides: z.object({
    title: z.string().optional(),
    deadline: z.string().nullable().optional(),
    domain: z.enum(['academic', 'work', 'personal', 'health', 'social', 'family']).optional(),
    effortEstimateHours: z.number().nonnegative().optional(),
    priority: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    description: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { suggestionId, userId, overrides } = parseResult.data;
    const now = Timestamp.now();

    // 1. Fetch suggestion from Firestore
    const suggestionRef = adminDb.collection("gmailSuggestions").doc(suggestionId);
    const suggestionDoc = await suggestionRef.get();

    if (!suggestionDoc.exists) {
      return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
    }

    const suggestion = suggestionDoc.data() as any;

    if (suggestion.status !== "pending") {
      return NextResponse.json({ error: "Suggestion is already processed" }, { status: 400 });
    }

    // 2. Map suggestion fields to CommitmentDraft
    const finalTitle = overrides?.title || suggestion.title;
    const finalDomain = overrides?.domain || suggestion.domain || "personal";
    const finalEffort = overrides?.effortEstimateHours !== undefined ? overrides.effortEstimateHours : (suggestion.effort || 1.0);
    const finalPriority = overrides?.priority || "medium";
    const finalDescription = overrides?.description || `Extracted from email: ${suggestion.subject}`;
    
    let finalDeadlineTimestamp: Timestamp | null = null;
    if (overrides?.deadline !== undefined) {
      finalDeadlineTimestamp = overrides.deadline ? Timestamp.fromDate(new Date(overrides.deadline)) : null;
    } else if (suggestion.deadline) {
      finalDeadlineTimestamp = suggestion.deadline;
    }

    // 3. Create commitment doc
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc();

    const commitmentData = {
      id: commitmentRef.id,
      title: finalTitle,
      description: finalDescription,
      domain: finalDomain,
      status: "active",
      priority: finalPriority,
      deadline: finalDeadlineTimestamp,
      effortEstimateHours: finalEffort,
      adjustedEffortHours: finalEffort, // will be modified in replanOnAdd
      completedEffortHours: 0,
      completionPercentage: 0,
      riskScore: 0,
      riskTrend: "stable",
      probabilityCurrentPath: 100,
      probabilityRecommendedPath: 100,
      source: "gmail",
      sourceFileUrl: null,
      gmailMessageId: suggestion.emailId || null,
      actionPlan: null,
      calendarEventIds: [],
      scheduledBlocks: [],
      calendarBlocks: [],
      nextCheckInAt: null,
      lastCheckInAt: null,
      checkInHistory: [],
      isLongTermGoal: false,
      lastResurfacedAt: null,
      tags: ["gmail"],
      createdAt: now,
      updatedAt: now,
      extractedByAI: true,
      extractionConfidence: suggestion.confidence || 0.8,
    };

    await commitmentRef.set(commitmentData);

    // 4. Trigger replanOnAdd
    let replanResult = null;
    try {
      replanResult = await replanOnAdd(userId, commitmentRef.id);
    } catch (replanErr: any) {
      console.error(`Replan failed for Gmail suggested commitment ${commitmentRef.id}:`, replanErr);
      replanResult = { error: replanErr.message || "Replan failed" };
    }

    // 5. Update suggestion status to approved
    await suggestionRef.update({
      status: "approved",
      updatedAt: now,
    });

    const updatedDoc = await commitmentRef.get();
    const updatedData = updatedDoc.data();

    // Serialize timestamps
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
    console.error("POST /api/gmail/approve error:", error);
    return NextResponse.json(
      { error: "APPROVE_FAILED", message: error.message || "Failed to approve Gmail suggestion" },
      { status: 500 }
    );
  }
}
