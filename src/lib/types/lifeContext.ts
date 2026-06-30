import { TimeSlot } from "./index";

export interface CoreLifeContext {
  userId: string;
  currentDateTime: string;           // ISO 8601
  timezone: string;
  availableSlotsThisWeek: TimeSlot[];
  preferredWorkHours: number[];
  underestimationFactor: number;
  domainEffortMultipliers?: Record<string, number>;
  averageAttentionSpanMinutes?: number;
  activeCommitments: {
    id: string;
    title: string;
    domain: string;
    deadline: string;
    riskScore: number;
    riskTrend: 'improving' | 'stable' | 'worsening';
    completionPercentage: number;
    remainingEffortHours: number;
    scheduledBlocks: TimeSlot[];
    priority?: 'critical' | 'high' | 'medium' | 'low';
  }[];
  stressScore: number;
  totalActiveCommitments: number;
  domainBalanceMetrics: Record<string, number>;
  _meta: {
    calendarFetchedAt: string;
    commitmentsSyncedAt: string;
    stressScoreComputedAt: string;
    contextAssembledAt: string;
  };
}

export interface ExtendedLifeContext extends CoreLifeContext {
  burnoutDetected?: boolean;
  recentCompletionRate: number;
  avgUnderestimation: number;
  mostProductiveDomain: string;
  commonFailureReason: string;
  pastWeek: {
    completedCommitments: { id: string; title: string; domain: string; actualEffortHours: number }[];
    missedCommitments: { id: string; title: string; reason: string | null }[];
    checkinsResponded: number;
    totalCheckins: number;
    actualEffortHours: number;
    estimatedEffortHours: number;
  };
  longTermGoals: { id: string; title: string; domain: string; lastResurfacedAt: string | null }[];
  recentRenegotiations: { commitmentTitle: string; failureReason: string; outcome: 'accepted' | 'rejected' | null }[];
  currentStreak: number;
  longestStreak: number;
  _meta: CoreLifeContext['_meta'] & {
    reflectionGeneratedAt: string | null;
    longTermGoalsReviewedAt: string | null;
    learningCoefficientsUpdatedAt: string;
  };
}
