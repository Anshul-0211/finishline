import { FirestoreDate } from "./commitment";

export interface UserPreferences {
  timezone?: string;
  defaultCalendarId?: string;
  workingHours?: {
    start: number; // e.g., 9
    end: number;   // e.g., 17
  };

  // Backward compatibility fields (required for riskEngine and utilities)
  defaultDomain: "academic" | "work" | "personal" | "health" | "social" | "family";
  notificationsEnabled: boolean;
  fcmToken: string;
  theme: "light" | "dark" | "system";
}

export interface LearningCoefficients {
  underestimationFactor: number;
  preferredWorkHours: number[];
  lastUpdated: FirestoreDate | null; // ISO 8601 string or Timestamp (made nullable)

  // Evolving fields for Phase 1/2
  averageAttentionSpanMinutes?: number;
  domainEffortMultipliers?: { [key: string]: number };

  // Backward compatibility fields
  avgProcrastinationBuffer?: number;
}

export interface UserStats {
  stressScore: number;
  stressScoreComputedAt?: FirestoreDate | null; // ISO 8601 string or Timestamp
  currentStreak: number;
  longestStreak: number;
  totalCommitmentsCreated: number;
  totalCompleted: number;

  // Backward compatibility fields
  totalMissed: number;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  googleCalendarRefreshToken?: string;
  googleGmailRefreshToken?: string;
  googleCalendarId?: string;
  fcmToken?: string;
  preferences: UserPreferences;
  learningCoefficients: LearningCoefficients;
  stats: UserStats;
  calendarLastFetchedAt?: FirestoreDate | null; // ISO 8601 string or Timestamp (made optional)
  lastReflectionGeneratedAt?: FirestoreDate | null; // ISO 8601 string or Timestamp (made optional)
  lastWeeklyPlan?: any; // Weekly Plan JSON object
  lastWeeklyReflection?: any; // Weekly Reflection JSON object
  lastWeeklyReflectionGeneratedAt?: FirestoreDate | null;
  lastWeeklyPlanGeneratedAt?: FirestoreDate | null;

  // Backward compatibility fields
  googleRefreshToken: string;
  googleAccessToken: string;
  createdAt: FirestoreDate;
  lastActiveAt: FirestoreDate;
  longTermGoalsReviewedAt?: FirestoreDate | null; // Made optional
  tokenExpiry?: FirestoreDate | null;
}
