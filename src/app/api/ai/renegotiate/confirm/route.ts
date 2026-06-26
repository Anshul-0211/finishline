import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { deleteCalendarBlock, writeCalendarBlock, getCalendarFreeSlots } from "@/lib/backend/calendar";
import { calculateRiskScore } from "@/lib/backend/riskEngine";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const RequestSchema = z.object({
  renegotiationId: z.string().min(1, "renegotiationId is required"),
  userId: z.string().min(1, "userId is required"),
});

function getMillis(val: any): number {
  if (!val) return Date.now();
  if (typeof val.toMillis === "function") {
    return val.toMillis();
  }
  if (typeof val.toDate === "function") {
    return val.toDate().getTime();
  }
  if (val instanceof Date) {
    return val.getTime();
  }
  if (typeof val === "number") {
    return val;
  }
  if (typeof val === "string") {
    return new Date(val).getTime();
  }
  return Date.now();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = RequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json({ error: parseResult.error.issues[0].message }, { status: 400 });
    }

    const { renegotiationId, userId } = parseResult.data;
    const now = Timestamp.now();
    const nowMs = now.toMillis();

    // 1. Fetch renegotiation document
    const renegRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("renegotiations")
      .doc(renegotiationId);

    const renegDoc = await renegRef.get();
    if (!renegDoc.exists) {
      return NextResponse.json({ error: "Renegotiation not found" }, { status: 404 });
    }

    const renegData = renegDoc.data() as any;
    if (renegData.status !== "open") {
      return NextResponse.json({ error: "Renegotiation is already closed" }, { status: 400 });
    }

    const proposedSchedule = renegData.proposedSchedule;
    if (!proposedSchedule || !Array.isArray(proposedSchedule.steps)) {
      return NextResponse.json({ error: "No proposed schedule found" }, { status: 400 });
    }

    // Validate expiration
    const expiresAt = renegData.proposedSchedule?.expiresAt;
    if (expiresAt && getMillis(expiresAt) < nowMs) {
      return NextResponse.json({ error: "Proposed schedule has expired" }, { status: 400 });
    }

    const commitmentId = renegData.commitmentId;

    // 2. Fetch commitment details
    const commitmentRef = adminDb
      .collection("users")
      .doc(userId)
      .collection("commitments")
      .doc(commitmentId);

    const commitmentDoc = await commitmentRef.get();
    if (!commitmentDoc.exists) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const commitment = commitmentDoc.data() as any;

    // 3. Delete old calendar blocks
    const oldBlocks = commitment.calendarBlocks || [];
    for (const block of oldBlocks) {
      if (block.calendarEventId) {
        try {
          await deleteCalendarBlock(userId, block.calendarEventId);
        } catch (calErr) {
          console.error(`Failed to delete old block ${block.calendarEventId}:`, calErr);
        }
      }
    }

    // 4. Fetch available free slots for dynamic allocation if needed
    let freeSlots: any[] = [];
    try {
      freeSlots = await getCalendarFreeSlots(userId, { days: 7 });
    } catch (calErr) {
      console.error("Failed to fetch free slots during confirmation:", calErr);
    }

    // 5. Schedule new proposed blocks
    const newBlocks: any[] = [];
    const newSchedBlocks: any[] = [];
    let calendarBlocksWritten = 0;

    for (const step of proposedSchedule.steps) {
      let startStr = "";
      let endStr = "";

      const stepDateStr = step.date;
      const durationMin = step.duration || 60;

      // Check if stepDateStr is a full datetime string or just a date
      const hasTime = stepDateStr.includes("T") || stepDateStr.includes(":");
      if (hasTime && new Date(stepDateStr).getTime() > Date.now()) {
        startStr = new Date(stepDateStr).toISOString();
        endStr = new Date(new Date(stepDateStr).getTime() + durationMin * 60 * 1000).toISOString();
      } else {
        // Just a date string (YYYY-MM-DD), find a free slot on that day
        const targetDatePart = stepDateStr.split("T")[0]; // YYYY-MM-DD
        const slotIndex = freeSlots.findIndex((slot) => {
          const slotStartStr = slot.start.split("T")[0];
          const slotStartMs = new Date(slot.start).getTime();
          const slotEndMs = new Date(slot.end).getTime();
          const slotDuration = (slotEndMs - slotStartMs) / (60 * 1000);
          return slotStartStr === targetDatePart && slotStartMs > Date.now() && slotDuration >= durationMin;
        });

        if (slotIndex !== -1) {
          const slot = freeSlots[slotIndex];
          const startMs = new Date(slot.start).getTime();
          startStr = new Date(startMs).toISOString();
          endStr = new Date(startMs + durationMin * 60 * 1000).toISOString();

          // Update free slot boundary
          freeSlots[slotIndex] = { ...slot, start: endStr };
        } else {
          // Fallback: 10:00 AM on that day
          const fallbackStart = new Date(`${targetDatePart}T10:00:00`);
          if (fallbackStart.getTime() > Date.now()) {
            startStr = fallbackStart.toISOString();
            endStr = new Date(fallbackStart.getTime() + durationMin * 60 * 1000).toISOString();
          } else {
            // Fallback: tomorrow at 10:00 AM
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const tomorrowDateStr = tomorrow.toISOString().split("T")[0];
            const tomorrowStart = new Date(`${tomorrowDateStr}T10:00:00`);
            startStr = tomorrowStart.toISOString();
            endStr = new Date(tomorrowStart.getTime() + durationMin * 60 * 1000).toISOString();
          }
        }
      }

      if (startStr && endStr) {
        try {
          const calendarEventId = await writeCalendarBlock(userId, {
            title: `${commitment.title} - ${step.description}`,
            start: startStr,
            end: endStr,
            commitmentId,
          });

          newBlocks.push({
            title: step.description,
            start: startStr,
            end: endStr,
            calendarEventId,
          });

          newSchedBlocks.push({
            start: startStr,
            end: endStr,
            calendarEventId,
          });

          calendarBlocksWritten++;
        } catch (writeErr) {
          console.error(`Failed to write new block during confirm:`, writeErr);
          // If a calendar write fails, save it locally without event ID to be retried
          newBlocks.push({
            title: step.description,
            start: startStr,
            end: endStr,
          });
        }
      }
    }

    // 6. Update commitment details
    const newDeadline = renegData.proposedDeadline || null;
    const commitmentUpdate: any = {
      calendarBlocks: newBlocks,
      scheduledBlocks: newSchedBlocks,
      calendarSyncStatus: calendarBlocksWritten === proposedSchedule.steps.length ? "synced" : "pending",
      updatedAt: now,
    };

    if (newDeadline) {
      commitmentUpdate.deadline = newDeadline;
    }

    // Fetch user details for risk calculation
    const userDoc = await adminDb.collection("users").doc(userId).get();
    const user = { id: userId, ...userDoc.data() } as any;

    const populatedCommitment = {
      ...commitment,
      ...commitmentUpdate,
      adjustedEffortHours: (commitment.effortEstimateHours || 0) * (user.learningCoefficients?.underestimationFactor || 1.0),
      completionPercentage: commitment.completionPercentage || 0,
      completedEffortHours: commitment.completedEffortHours || 0,
      effortEstimateHours: commitment.effortEstimateHours || 0,
      scheduledBlocks: newSchedBlocks,
    };

    const newRiskScore = calculateRiskScore(populatedCommitment, user);
    commitmentUpdate.riskScore = newRiskScore;
    commitmentUpdate.riskTrend = newRiskScore > (commitment.riskScore || 0) ? "up" : (newRiskScore < (commitment.riskScore || 0) ? "down" : "stable");

    await commitmentRef.update(commitmentUpdate);

    // 7. Resolve renegotiation status
    await renegRef.update({
      status: "resolved",
      updatedAt: now,
    });

    return NextResponse.json({
      newRiskScore,
      calendarBlocksWritten,
    });
  } catch (error: any) {
    console.error("POST /api/ai/renegotiate/confirm error:", error);
    return NextResponse.json(
      { error: "CONFIRMATION_FAILED", message: error.message || "Failed to confirm renegotiation schedule" },
      { status: 500 }
    );
  }
}
