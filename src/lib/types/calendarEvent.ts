export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  start: string; // ISO 8601 string or date string
  end: string;   // ISO 8601 string or date string
  isAllDay: boolean;
  colorId?: string;
  location?: string;
  recurringEventId?: string;
  organizerEmail?: string;
  selfResponseStatus?: "accepted" | "tentative" | "needsAction" | "declined";
}
