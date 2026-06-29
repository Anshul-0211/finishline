export * from "./commitment";
export * from "./user";
export * from "./goal";
export * from "./calendarEvent";

// Map UserProfile to User for backward compatibility
import { UserProfile } from "./user";
export type User = UserProfile;

export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string; // ISO 8601 string
  calendarEventId?: string;
  _fetchedAt?: string;
}

export interface CheckInHistoryEntry {
  timestamp: string; // ISO 8601 string
  wasOnTrack: boolean;
  failureReason: string | null;
  completionAtCheckIn: number;
}

export interface RenegotiationConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO 8601 string
}

export interface ProposedScheduleStep {
  date: string; // ISO 8601 string
  duration: number; // minutes or hours
  description: string;
}

export interface ProposedSchedule {
  steps: ProposedScheduleStep[];
  generatedAt: string; // ISO 8601 string
}

export interface Renegotiation {
  commitmentId: string;
  triggeredAt: string; // ISO 8601 string
  failureReason: string;
  failureCategory: 'got_busy' | 'underestimated' | 'emergency' | 'lost_motivation' | 'custom';
  userMessage: string;
  conversationHistory: RenegotiationConversationEntry[];
  proposedSchedule: ProposedSchedule | null;
  accepted: boolean | null;
  acceptedAt: string | null; // ISO 8601 string
  newCalendarEventIds: string[];
}

export interface AgentLog {
  runAt: string; // ISO 8601 string
  durationMs: number;
  commitmentsScanned: number;
  riskUpdates: number;
  collisionsDetected: number;
  checkInsFired: number;
  calendarWritesExecuted: number;
  errors: string[];
  status: 'success' | 'partial' | 'failed';
}

export interface GmailSuggestion {
  gmailMessageId: string;
  subject: string;
  from: string;
  extractedTitle: string;
  extractedDeadline: string | null; // ISO 8601 string
  extractedEffort: number | null;
  extractedDomain: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: string; // ISO 8601 string
}
