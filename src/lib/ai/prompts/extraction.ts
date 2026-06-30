export const EXTRACTION_SYSTEM_INSTRUCTION = `You are an advanced AI assistant designed to extract structured commitment data from user text or voice transcript inputs.
Your goal is to parse natural language, detect dates, durations, and other context, and build a JSON array of structured commitment drafts.

If the user input contains multiple distinct commitments (e.g., "I have physics homework due tomorrow and a dentist appointment this Tuesday"), you MUST extract them as separate commitment draft objects in the JSON array. Do not merge separate commitments into a single object. If there is only one commitment, still return a JSON array containing that single object.

Guidelines for extraction (per commitment):
1. **Title**: A clear, concise summary of the commitment (e.g., "OS Basics Assignment").
2. **Description**: Details about what the commitment involves.
3. **Domain**: Classify the commitment into one of: 'academic', 'work', 'personal', 'health', 'social', 'family'.
4. **Deadline**: Extract the deadline.
   - ABSOLUTE PROHIBITION ON CALENDAR MATH: You are strictly forbidden from performing any date addition, subtraction, or calendar calculations of your own. You do not know how many days are in a month, whether it is a leap year, or what absolute date corresponds to a relative weekday.
   - MANDATORY LOOKUP RULE: You must resolve all relative terms (e.g., "today", "tomorrow", "this Friday", "next Monday", "Wednesday") exclusively and verbatim by looking up the value in the server-provided REFERENCE CALENDAR MAPPING table.
   - LOOKUP METHODOLOGY:
     * Locate the weekday or relative term in the reference table.
     * Retrieve the exact associated YYYY-MM-DD date.
     * Format the output deadline as an ISO 8601 string at the end of that day (e.g., "2026-07-03T23:59:59.000Z") or use a specific time mentioned in the text (e.g., "12 PM" -> "2026-07-03T12:00:00.000Z").
     * If the commitment is a long-term goal with no specific deadline, or if the deadline is entirely unspecified, return null.
5. **Is Long Term Goal**: Set to true if the commitment is a long-term goal/aspiration rather than a specific short-term task.
6. **Effort Estimate**: Estimate the number of hours required to complete this task. If not mentioned, estimate a realistic duration based on standard task types, minimum 0.5.
7. **Priority**: Assign 'critical', 'high', 'medium', or 'low'.
8. **Difficulty**: Classify the difficulty as 'easy', 'medium', 'hard', or 'expert'.
9. **Estimated Cognitive Load**: Classify as 'low', 'medium', 'high'.
10. **Commitment Type**: Classify as 'assignment', 'exam', 'project', 'meeting', 'event', 'interview', or 'other'.
11. **Confidence**: Your confidence score (between 0.0 and 1.0) in this extraction.
12. **Reasoning**: A brief explanation of why you extracted these fields. Make sure to specify how you mapped the relative day of the week to the absolute date based on the provided reference.
13. **Extracted Entities**: Extract any mentioned people, locations, and tools.

Handle natural language variations, including code mixing (like Hinglish, e.g. "kal submission hai yaar" means the deadline is tomorrow and domain is academic/work).`;

/**
 * Generates a 100% deterministic, timezone-safe relative-to-absolute calendar reference mapping table.
 * It takes a baseInput (which can be a YYYY-MM-DD string or a Date) and a target timezone, extracts the
 * exact local year, month, and day, and increments the days using UTC calculations to prevent
 * any timezone offset shift, midnight-rollover bugs, or daylight savings adjustments.
 */
export function getWeeklyCalendarMapping(baseInput: Date | string, timezone: string): string {
  let year: number;
  let month: number;
  let day: number;

  if (typeof baseInput === "string") {
    const match = baseInput.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      year = parseInt(match[1], 10);
      month = parseInt(match[2], 10) - 1; // 0-indexed
      day = parseInt(match[3], 10);
    } else {
      const parsedDate = new Date(baseInput);
      const date = isNaN(parsedDate.getTime()) ? new Date() : parsedDate;
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).formatToParts(date);
      year = parseInt(parts.find(p => p.type === "year")!.value, 10);
      month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
      day = parseInt(parts.find(p => p.type === "day")!.value, 10);
    }
  } else {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(baseInput);
    year = parseInt(parts.find(p => p.type === "year")!.value, 10);
    month = parseInt(parts.find(p => p.type === "month")!.value, 10) - 1;
    day = parseInt(parts.find(p => p.type === "day")!.value, 10);
  }

  const result: string[] = [];

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const isoFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (let i = 0; i <= 10; i++) {
    // JS Date handles year/month rollovers correctly and deterministically in UTC
    const tempDate = new Date(Date.UTC(year, month, day + i));
    const parts = formatter.formatToParts(tempDate);
    const weekday = parts.find(p => p.type === "weekday")?.value || "";
    const monthName = parts.find(p => p.type === "month")?.value || "";
    const dayValue = parts.find(p => p.type === "day")?.value || "";
    const yearValue = parts.find(p => p.type === "year")?.value || "";
    const isoStr = isoFormatter.format(tempDate); // YYYY-MM-DD

    let label = `${weekday}`;
    if (i === 0) {
      label += " (today)";
    } else if (i === 1) {
      label += " (tomorrow)";
    } else if (i === 2) {
      label += " (2 days from today)";
    } else {
      label += ` (${i} days from today)`;
    }

    result.push(`- ${label}: ${monthName} ${dayValue}, ${yearValue} (${isoStr})`);
  }

  return result.join("\n");
}

export function buildExtractionPrompt(input: string, today: string, timezone: string): string {
  const match = today.match(/\((\d{4}-\d{2}-\d{2})\)/);
  const baseInput = match ? match[1] : new Date();
  const mappingTable = getWeeklyCalendarMapping(baseInput, timezone);

  return `Extract structured commitment data from the user's input.
Today's date and day of week: ${today}. User's timezone: ${timezone}.

[CRITICAL WARNING] DO NOT calculate the deadline date using your own calendar math.
Instead, use the REFERENCE CALENDAR MAPPING table below. Find the weekday or relative term mentioned in the user input and use the exact YYYY-MM-DD date specified for that day.
Do NOT under any circumstances assume today is Monday or perform incorrect date calculations.

REFERENCE CALENDAR MAPPING:
${mappingTable}

User input: "${input}"`;
}
