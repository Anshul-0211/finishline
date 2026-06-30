import { getWeeklyCalendarMapping } from "./extraction";

export const FILE_EXTRACTION_SYSTEM_INSTRUCTION = `You are an expert document analysis AI. Your task is to analyze a document (such as a PDF or image) and extract all tasks, commitments, assignments, exams, meetings, or other schedules.
You must return an array of commitments. Even if only one commitment is found, return it as a single-element array.

For each commitment, extract and map to these exact keys:
1. **title**: Concise title (e.g., "Operating Systems Assignment").
2. **description**: Detailed description of the task.
3. **domain**: one of: 'academic', 'work', 'personal', 'health', 'social', 'family'.
4. **deadline**: ISO 8601 date-time or date string (or null if none).
   - ABSOLUTE PROHIBITION ON CALENDAR MATH: You are strictly forbidden from performing any date addition, subtraction, or calendar calculations of your own. You do not know how many days are in a month, whether it is a leap year, or what absolute date corresponds to a relative weekday.
   - MANDATORY LOOKUP RULE: You must resolve all relative terms (e.g., "today", "tomorrow", "this Friday", "next Monday", "Wednesday") exclusively and verbatim by looking up the value in the server-provided REFERENCE CALENDAR MAPPING table.
   - LOOKUP METHODOLOGY:
     * Locate the weekday or relative term in the reference table.
     * Retrieve the exact associated YYYY-MM-DD date.
     * Format the output deadline as an ISO 8601 string at the end of that day (e.g., "2026-07-03T23:59:59.000Z") or use a specific time mentioned in the text (e.g., "12 PM" -> "2026-07-03T12:00:00.000Z").
     * If the commitment has no specific deadline, or if the deadline is entirely unspecified, return null.
5. **isLongTermGoal**: True if it's a long-term goal.
6. **effortEstimateHours**: Estimated hours (minimum 0.5).
7. **priority**: 'critical', 'high', 'medium', 'low'.
8. **difficulty**: 'easy', 'medium', 'hard', 'expert'.
9. **estimatedCognitiveLoad**: 'low', 'medium', 'high'.
10. **commitmentType**: 'assignment', 'exam', 'project', 'meeting', 'event', 'interview', 'other'.
11. **confidence**: Your confidence score (0.0 to 1.0).
12. **reasoning**: A brief explanation of the extraction, explaining how you mapped relative weekdays to absolute dates based on the provided today's reference.
13. **practicalVsTheoretical**: 'practical', 'theoretical', 'mixed', or null.
14. **questionCount**: number of questions/problems or null.
15. **recommendedSessions**: number of sessions recommended.
16. **prerequisiteKnowledge**: array of strings.
17. **stakeholderImportance**: 'low', 'medium', 'high', 'critical'.
18. **requiredResponse**: boolean indicating if a reply or confirmation is required.
19. **extractedEntities**: object with arrays: { people: string[], locations: string[], tools: string[] }
`;

export function buildFileExtractionPrompt(today: string, timezone: string = "UTC"): string {
  const match = today.match(/\((\d{4}-\d{2}-\d{2})\)/);
  const baseInput = match ? match[1] : new Date();
  const mappingTable = getWeeklyCalendarMapping(baseInput, timezone);

  return `Please analyze the uploaded document and extract all commitments and tasks.
Today's date and day of week: ${today}. Use this to perform precise calendar math for all deadlines.

[CRITICAL WARNING] DO NOT calculate any deadline dates using your own calendar math.
Instead, use the REFERENCE CALENDAR MAPPING table below. Find the weekday or relative day mentioned in the document and map it to the exact YYYY-MM-DD date specified.

REFERENCE CALENDAR MAPPING:
${mappingTable}`;
}
