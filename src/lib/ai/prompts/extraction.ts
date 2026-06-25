export function buildExtractionPrompt(input: string, today: string, timezone: string): string {
  return `Extract structured commitment data from the user's input.
Today's date: ${today}. User's timezone: ${timezone}.

User input: "${input}"`;
}

export function buildFileExtractionPrompt(today: string): string {
  return `You are analyzing a document to extract all commitments, deadlines, and tasks.
Look for: deadlines, submission dates, meeting invites, task lists, event details.
Today's date: ${today}.`;
}
