import { getWeeklyCalendarMapping } from "./extraction";

export const GMAIL_CLASSIFIER_SYSTEM_INSTRUCTION = `You are a professional email assistant. Your task is to analyze an incoming email and determine if it contains any commitment, action item, task, or deadline that the user needs to schedule or follow up on.

You must return a JSON object with these exact keys:
1. **gmailMessageId**: The exact message ID provided in the input.
2. **subject**: The exact subject header provided in the input.
3. **from**: The exact sender header provided in the input.
4. **hasCommitment**: Boolean. True if the email requests the user to perform an action, attend a meeting, submit a project, prepare for an interview, or follow up on a task. False otherwise.
5. **extractedTitle**: If hasCommitment is true, a concise title for the task (e.g. "Prepare for Amazon Interview"). Empty string if false.
6. **extractedDeadline**: If hasCommitment is true, the calculated ISO 8601 deadline.
   - ABSOLUTE PROHIBITION ON CALENDAR MATH: You are strictly forbidden from performing any date addition, subtraction, or calendar calculations of your own. You do not know how many days are in a month, whether it is a leap year, or what absolute date corresponds to a relative weekday.
   - MANDATORY LOOKUP RULE: You must resolve all relative terms (e.g., "today", "tomorrow", "this Friday", "next Monday", "Wednesday") exclusively and verbatim by looking up the value in the server-provided REFERENCE CALENDAR MAPPING table.
   - LOOKUP METHODOLOGY:
     * Locate the weekday or relative term in the reference table.
     * Retrieve the exact associated YYYY-MM-DD date.
     * Format the output deadline as an ISO 8601 string at the end of that day (e.g., "2026-07-03T23:59:59.000Z") or use a specific time mentioned in the text (e.g., "12 PM" -> "2026-07-03T12:00:00.000Z").
     * If there is no specific deadline, or if the deadline is entirely unspecified, return null.
7. **extractedEffort**: Estimated effort in hours for the task (minimum 0.5), or null if hasCommitment is false.
8. **extractedDomain**: The domain of the task ('academic', 'work', 'personal', 'health', 'social', 'family'). Default is 'work' or 'personal'.
9. **confidence**: Your confidence score (0.0 to 1.0) that this email contains a commitment.
10. **reasoning**: A brief explanation of your classification decision, explaining how you mapped relative weekdays to absolute dates based on the provided today's reference.
11. **urgencyLevel**: Classify how urgent the response/action is: 'low', 'medium', 'high', 'critical'.
12. **senderImportance**: Assess the sender's importance/type:
    - 'recruiter': If the email is from a recruiter, hiring manager, or job application portal.
    - 'vip': If from a high-value sender like a boss, professor, client, or family member.
    - 'high', 'medium', 'low': For other standard classifications.
13. **requiresResponse**: Boolean. True if the email explicitly requests or implies a response/reply.
14. **responseDeadline**: The deadline to send a reply (ISO 8601 format), or null if not specified.
`;

export function buildGmailClassifierPrompt(
  gmailMessageId: string,
  subject: string,
  from: string,
  body: string,
  today: string,
  timezone: string = "UTC"
): string {
  const match = today.match(/\((\d{4}-\d{2}-\d{2})\)/);
  const baseInput = match ? match[1] : new Date();
  const mappingTable = getWeeklyCalendarMapping(baseInput, timezone);

  return `Please classify this email for commitments and action items:
Gmail Message ID: ${gmailMessageId}
Today's Date and Day of Week: ${today}
User's Timezone: ${timezone}

REFERENCE CALENDAR MAPPING (Use this table for 100% precise lookups of relative days of the week to absolute dates, do not do math yourself):
${mappingTable}

From: ${from}
Subject: ${subject}

Body:
"""
${body}
"""`;
}
