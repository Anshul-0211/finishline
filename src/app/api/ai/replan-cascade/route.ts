import { NextRequest, NextResponse } from "next/server";
import { ensureFreshContext } from "@/lib/ai/freshness";
import { callGateway } from "@/lib/ai/gateway";
import { ReplanCascadeSchema } from "@/lib/ai/schemas/replanCascade";
import { buildReplanCascadePrompt, REPLAN_CASCADE_SYSTEM_INSTRUCTION } from "@/lib/ai/prompts/replanCascade";
import { applyConfidenceAwareness, deriveConfidenceLabel } from "@/lib/ai/confidence";
import { CoreLifeContext } from "@/lib/ai/types";
import { verifyAuth } from "@/lib/auth/authVerification";

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required parameter: userId" },
        { status: 400 }
      );
    }

    // Verify authentication and ownership
    await verifyAuth(req, userId);

    // 1. Fetch fresh Core Life Context
    console.log(`[replan-cascade] Fetching fresh CoreLifeContext for user: ${userId}...`);
    const context = await ensureFreshContext(userId, "core");

    if (!context || !context.activeCommitments) {
      return NextResponse.json(
        { error: "No active commitments found to optimize" },
        { status: 400 }
      );
    }

    // 2. Sort active commitments deterministically by:
    //    1) deadline proximity, 2) priority weight, 3) remaining effort hours
    const priorityWeights: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1
    };

    const sortedCommitments = [...context.activeCommitments].sort((a, b) => {
      // 1) deadline proximity (earlier deadlines first)
      const dateA = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const dateB = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      if (dateA !== dateB) {
        return dateA - dateB;
      }

      // 2) priority weight (higher priority first)
      const pA = priorityWeights[a.priority || "medium"] || 2;
      const pB = priorityWeights[b.priority || "medium"] || 2;
      if (pA !== pB) {
        return pB - pA;
      }

      // 3) remaining effort hours (larger hours first)
      if (a.remainingEffortHours !== b.remainingEffortHours) {
        return b.remainingEffortHours - a.remainingEffortHours;
      }

      // Deterministic tie-breaker
      return a.id.localeCompare(b.id);
    });

    // Update context with sorted commitments
    const sortedContext: CoreLifeContext = {
      ...context,
      activeCommitments: sortedCommitments
    };

    // 3. Build Prompt
    const prompt = buildReplanCascadePrompt(sortedContext);

    // 4. Invoke AI Gateway using 'action-plan' endpointType (0.4 temperature)
    console.log("[replan-cascade] Calling AI Gateway...");
    const rawResult = await callGateway<any>({
      systemInstruction: REPLAN_CASCADE_SYSTEM_INSTRUCTION,
      prompt,
      schema: ReplanCascadeSchema as any,
      endpointType: "action-plan",
    });

    // 5. Enrich with confidence metadata and user review flag
    const enrichedResult = applyConfidenceAwareness(rawResult);
    const finalResult = {
      ...enrichedResult,
      aiMeta: {
        ...enrichedResult.aiMeta,
        confidenceLabel: deriveConfidenceLabel(enrichedResult.aiMeta.confidence),
      },
    };

    return NextResponse.json(finalResult, { status: 200 });

  } catch (err: any) {
    if (err.status) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[replan-cascade] Critical error during cascade replanning:", msg);
    return NextResponse.json({ error: "Global cascade replanning failed", details: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
