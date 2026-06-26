export function buildGmailClassifierPrompt(
  emailText: string,
  sender: string,
  subject: string,
  today: string
): string {
  return `You are analyzing an email to determine if it contains a commitment, task, deadline, meeting, or event for the user.
Today's date: ${today}.

Email Metadata:
- From: ${sender}
- Subject: ${subject}

Email Content (truncated):
"${emailText}"

Analyze the content. If this email contains a commitment, extract the title, deadline (if any, as ISO 8601), estimated effort in hours (if any), and domain ('academic', 'work', 'personal', 'health', 'social', 'family').
Assign a confidence score (0.0 to 1.0) indicating how likely this email contains an actionable commitment for the user.
If there is NO commitment or task in the email, set confidence to less than 0.5 (e.g. 0.0) and return placeholders.`;
}
