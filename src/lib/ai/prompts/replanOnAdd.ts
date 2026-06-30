import { CoreLifeContext } from "../types";

export const REPLAN_ON_ADD_SYSTEM_INSTRUCTION = `You are FinishLine's expert scheduling engine. Your job is to check for schedule overlaps (collisions) when a new commitment is added with proposed calendar slots, and dynamically propose adjustments to resolve them.

You will receive:
1. The new commitment's details (including its title, type, estimated effort, and deadline).
2. The proposed blocks (time slots) for the new commitment.
3. The user's Core Life Context (active commitments with their types, scheduled blocks, available calendar openings, preferred work hours, stress score, and average attention span).

Commitment Type Scheduling Rules:
1. **Fixed-Time / Contiguous Events** (types: 'meeting', 'event', 'interview', 'exam'):
   - **STRICT RULE**: These represent fixed sessions that MUST NOT be split into smaller blocks or attention-span chunks. They must remain as single contiguous blocks.
   - **STRICT RULE**: These MUST NOT be rescheduled to random prior days or slots. They are bound to their proposed designated start/end times.
   - **STRICT RULE**: Do NOT flag an event's proposed block as "after its deadline" or conflicting just because it ends at or after the deadline timestamp. The deadline for an event matches its start/end window, so running the actual event itself is fully valid and expected.
   - **STRICT RULE**: If a fixed-time event overlaps with existing scheduled blocks of flexible commitments, ALWAYS resolve the conflict by shifting or splitting the **flexible commitments** to other free openings, keeping the fixed-time event untouched.
2. **Flexible / Chunkable Tasks** (types: 'assignment', 'project', 'other'):
   - These represent work to be done over time. They CAN be split into smaller chunks (matching preferred attention span, e.g. 90 mins), scheduled into any available slots prior to their deadlines, and shifted freely.

Your tasks:
1. Check if the new commitment's proposed blocks overlap with existing scheduled blocks.
2. Resolve conflicts following the Commitment Type Scheduling Rules above.
3. Prioritize slots that fall within the user's preferred work hours and fit available calendar openings.
4. Scale shifts and slot lengths to respect the user's attention span and domain effort multipliers for flexible tasks.
5. Explain your reasoning and output the results.

You must return a JSON object with these exact keys:
1. **summary**: A concise, friendly summary of the scheduling audit and what changes are suggested to keep the calendar balanced.
2. **conflictsDetected**: An array of strings describing each identified collision (e.g. "New task on Tuesday at 10 AM collides with OS Assignment").
3. **conflictsAvoided**: An array of strings describing any proposed blocks that do not overlap and are safe.
4. **adjustments**: An array of adjustment objects:
   [{
     "commitmentId": string,
     "commitmentTitle": string,
     "originalBlock": { "start": string (ISO), "end": string (ISO) },
     "proposedBlock": { "start": string (ISO), "end": string (ISO) }
   }]
   If no shifts are needed, leave this array empty.
5. **requiresUserReview**: A boolean indicating if the collision resolution requires manual user sign-off.
6. **reviewReason**: A string explaining why user review is needed, or null if not required.
7. **aiMeta**: { "confidence": number (0.0 to 1.0), "confidenceLabel": "low"|"medium"|"high"|"very_high", "reasoning": string }
`;

export function buildReplanOnAddPrompt(
  newCommitment: any,
  proposedBlocks: { start: string; end: string }[],
  context: CoreLifeContext
): string {
  // Filter core context to only transport allowed core-tier fields
  const filteredActiveCommitments = (context.activeCommitments || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    domain: c.domain,
    commitmentType: c.commitmentType || "assignment",
    deadline: c.deadline,
    remainingEffortHours: c.remainingEffortHours,
    scheduledBlocks: c.scheduledBlocks || []
  }));

  const filteredContext = {
    currentDateTime: context.currentDateTime,
    timezone: context.timezone,
    underestimationFactor: context.underestimationFactor,
    domainEffortMultipliers: context.domainEffortMultipliers,
    averageAttentionSpanMinutes: context.averageAttentionSpanMinutes,
    preferredWorkHours: context.preferredWorkHours,
    availableSlotsThisWeek: context.availableSlotsThisWeek,
    stressScore: context.stressScore,
    activeCommitments: filteredActiveCommitments
  };

  return `Verify calendar scheduling collisions and resolve overlaps for this new commitment.

New Commitment Details:
- Title: ${newCommitment.title}
- Domain: ${newCommitment.domain}
- Commitment Type: ${newCommitment.commitmentType || "assignment"} (Fixed events MUST NOT be split or rescheduled to random dates!)
- Estimated Effort: ${newCommitment.effortEstimateHours} hours
- Deadline: ${newCommitment.deadline || "None"}

Proposed Time Blocks for New Commitment:
${JSON.stringify(proposedBlocks, null, 2)}

User Core Life Context:
${JSON.stringify(filteredContext, null, 2)}

Instructions:
Review all schedules. Check if the proposed blocks overlap with existing commitments.
- If the new commitment is a FIXED-TIME EVENT ('meeting', 'event', 'interview', 'exam'), keep its proposed blocks exactly as-is (do not split or shift them). If any existing flexible tasks ('assignment', 'project', 'other') overlap, shift or split those existing flexible tasks to other available slots instead of modifying the fixed event.
- If the new commitment is a FLEXIBLE TASK ('assignment', 'project', 'other') and overlaps exist, shift or split it into free openings prior to its deadline.`;
}
