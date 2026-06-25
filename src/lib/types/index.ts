export interface UserPreferences {
  defaultDomain: 'academic' | 'work' | 'personal' | 'health' | 'social' | 'family';
  workingHours: { start: number; end: number }; // e.g., start: 9, end: 18
  theme: 'light' | 'dark' | 'system';
  notificationsEnabled: boolean;
  fcmToken: string;
}

export interface LearningCoefficients {
  underestimationFactor: number; // default: 1.0
  preferredWorkHours: number[]; // e.g., [9, 10, 14, 15, 20, 21]
  avgProcrastinationBuffer: number; // hours before deadline user actually starts
  lastUpdated: any; // Timestamp
}

export interface UserStats {
  totalCommitmentsCreated: number;
  totalCompleted: number;
  totalMissed: number;
  currentStreak: number;
  longestStreak: number;
  stressScore: number; // 0-100
  stressScoreComputedAt?: any; // Timestamp
}

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  googleAccessToken: string; // encrypted
  googleRefreshToken: string; // encrypted
  tokenExpiry: any; // Timestamp
  preferences: UserPreferences;
  learningCoefficients: LearningCoefficients;
  stats: UserStats;
  createdAt: any; // Timestamp
  lastActiveAt: any; // Timestamp
  calendarLastFetchedAt?: any; // Timestamp
  lastReflectionGeneratedAt?: any; // Timestamp
  longTermGoalsReviewedAt?: any; // Timestamp
}

export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string; // ISO 8601 string
  calendarEventId?: string;
  _fetchedAt?: string;
}

export interface ActionPlanStep {
  id: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
  completedAt: any | null; // Timestamp
  suggestedTimeSlot?: string;
  cognitiveIntensity?: 'low' | 'medium' | 'high';
  notes?: string;
}

export interface ActionPlan {
  steps: ActionPlanStep[];
  generatedAt: any; // Timestamp
}

export interface ScheduledBlock {
  start: any; // Timestamp
  end: any; // Timestamp
  calendarEventId: string;
}

export interface CheckInHistoryEntry {
  timestamp: any; // Timestamp
  wasOnTrack: boolean;
  failureReason: string | null;
  completionAtCheckIn: number;
}

export interface Commitment {
  id: string;
  title: string;
  description: string;
  domain: 'academic' | 'work' | 'personal' | 'health' | 'social' | 'family';
  status: 'active' | 'completed' | 'missed' | 'renegotiating' | 'snoozed';
  priority: 'critical' | 'high' | 'medium' | 'low';

  // Deadline & Effort
  deadline: any; // Timestamp
  effortEstimateHours: number;
  adjustedEffortHours: number; // effortEstimateHours * underestimationFactor
  completedEffortHours: number;
  completionPercentage: number; // 0-100

  // Risk Engine
  riskScore: number; // 0-100
  riskTrend: 'improving' | 'stable' | 'worsening';
  probabilityCurrentPath: number; // 0-100
  probabilityRecommendedPath: number; // 0-100

  // Source metadata
  source: 'text' | 'pdf' | 'image' | 'voice' | 'gmail' | 'manual';
  sourceFileUrl: string | null;
  gmailMessageId: string | null;

  // Action Plan
  actionPlan: ActionPlan | null;

  // Calendar
  calendarEventIds: string[];
  scheduledBlocks: ScheduledBlock[];

  // Check-in tracking
  nextCheckInAt: any | null; // Timestamp
  lastCheckInAt: any | null; // Timestamp
  checkInHistory: CheckInHistoryEntry[];

  // Memory & resurface
  isLongTermGoal: boolean;
  lastResurfacedAt: any | null; // Timestamp

  // Metadata
  tags: string[];
  createdAt: any; // Timestamp
  updatedAt: any; // Timestamp
  extractedByAI: boolean;
  extractionConfidence: number; // 0-1
}

export interface RenegotiationConversationEntry {
  role: 'user' | 'assistant';
  content: string;
  timestamp: any; // Timestamp
}

export interface ProposedScheduleStep {
  date: any; // Timestamp
  duration: number; // minutes or hours
  description: string;
}

export interface ProposedSchedule {
  steps: ProposedScheduleStep[];
  generatedAt: any; // Timestamp
}

export interface Renegotiation {
  commitmentId: string;
  triggeredAt: any; // Timestamp
  failureReason: string;
  failureCategory: 'got_busy' | 'underestimated' | 'emergency' | 'lost_motivation' | 'custom';
  userMessage: string;
  conversationHistory: RenegotiationConversationEntry[];
  proposedSchedule: ProposedSchedule | null;
  accepted: boolean | null;
  acceptedAt: any | null; // Timestamp
  newCalendarEventIds: string[];
}

export interface AgentLog {
  runAt: any; // Timestamp
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
  extractedDeadline: any | null; // Timestamp
  extractedEffort: number | null;
  extractedDomain: string;
  confidence: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: any; // Timestamp;
}
