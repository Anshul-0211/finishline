export type EndpointType =
  | 'extraction'
  | 'explanation'
  | 'action-plan'
  | 'renegotiation'
  | 'weekly-planning'
  | 'weekly-reflection'
  | 'replan-cascade';


export interface AIResponseMeta {
  confidence: number; // 0.0-1.0
  confidenceLabel: 'low' | 'medium' | 'high' | 'very_high';
  reasoning: string; // 1 sentence explanation
}

export interface TimeSlot {
  start: string; // ISO 8601 string
  end: string; // ISO 8601 string
  calendarEventId?: string;
  _fetchedAt?: string;
}

export interface CoreLifeContext {
  userId: string;
  currentDateTime: string; // ISO 8601
  timezone: string;
  availableSlotsThisWeek: TimeSlot[];
  preferredWorkHours: number[]; // e.g. [9, 10, 14, 15, 20, 21]
  underestimationFactor: number;
  domainEffortMultipliers?: Record<string, number>;
  averageAttentionSpanMinutes?: number;
  activeCommitments: {
    id: string;
    title: string;
    domain: string;
    deadline: string; // ISO 8601
    riskScore: number;
    riskTrend: 'improving' | 'stable' | 'worsening';
    completionPercentage: number;
    remainingEffortHours: number;
    scheduledBlocks: TimeSlot[];
    priority?: 'critical' | 'high' | 'medium' | 'low';
  }[];
  stressScore: number; // 0-100
  totalActiveCommitments: number;
  domainBalanceMetrics: Record<string, number>;
  _meta: {
    calendarFetchedAt: string; // ISO 8601
    commitmentsSyncedAt: string;
    stressScoreComputedAt: string;
    contextAssembledAt: string;
  };
}

export interface ExtendedLifeContext extends CoreLifeContext {
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
  longTermGoals: {
    id: string;
    title: string;
    domain: string;
    lastResurfacedAt: string | null;
  }[];
  recentRenegotiations: {
    commitmentTitle: string;
    failureReason: string;
    outcome: 'accepted' | 'rejected' | null;
  }[];
  currentStreak: number;
  longestStreak: number;
  _meta: CoreLifeContext['_meta'] & {
    reflectionGeneratedAt: string | null;
    longTermGoalsReviewedAt: string | null;
    learningCoefficientsUpdatedAt: string;
  };
}

export interface CommitmentDraft {
  title: string;
  description: string;
  domain: 'academic' | 'work' | 'personal' | 'health' | 'social' | 'family';
  deadline: string | null; // ISO 8601
  isLongTermGoal: boolean;
  effortEstimateHours: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  reasoning: string;

  // New fields (extracted from files/documents)
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  estimatedCognitiveLoad: 'low' | 'medium' | 'high';
  commitmentType: 'assignment' | 'exam' | 'project' | 'meeting' | 'event' | 'interview' | 'other';
  practicalVsTheoretical: 'practical' | 'theoretical' | 'mixed' | null;
  questionCount: number | null;
  recommendedSessions: number;
  prerequisiteKnowledge: string[];
  stakeholderImportance: 'low' | 'medium' | 'high' | 'critical';
  requiredResponse: boolean;
  extractedEntities: {
    people: string[];
    locations: string[];
    tools: string[];
  };
}

export interface ActionPlanStepResponse {
  id: string;
  title: string;
  estimatedMinutes: number;
  suggestedTimeSlot: string | null; // ISO 8601
  cognitiveIntensity: 'low' | 'medium' | 'high' | null;
  notes: string | null;
}

export interface ActionPlanResponse {
  steps: ActionPlanStepResponse[];
  totalMinutes: number;
  suggestedSessionLength: number;
  recommendedDaysSpread: number;
  aiMeta: AIResponseMeta;
}

export interface ProposedScheduleStepResponse {
  date: string; // ISO 8601 date string
  duration: number; // in minutes
  description: string;
}

export interface RenegotiationResponse {
  message: string;
  hasProposedSchedule: boolean;
  proposedSchedule: {
    steps: ProposedScheduleStepResponse[];
    generatedAt: string; // ISO 8601
  } | null;
  newDeadline: string | null; // ISO 8601
  conflictsAvoided: string[];
  aiMeta: AIResponseMeta;
}

export interface WeeklyPlanCommitment {
  id: string;
  title: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reasoning: string;
}

export interface WeeklyPlanDailyFocus {
  day: string; // Monday, Tuesday, etc.
  focus: string;
  commitments: string[]; // commitment titles or IDs
}

export interface WeeklyPlanResponse {
  weekSummary: string;
  prioritizedCommitments: WeeklyPlanCommitment[];
  recommendedDailyFocus: WeeklyPlanDailyFocus[];
  warningFlags: string[];
  lifeDomainAdvice: string;
  resurfacedGoals: string[];
  weeklyIntention: string;
  aiMeta: AIResponseMeta;
}

export interface WeeklyReflectionResponse {
  completionRate: number;
  narrative: string;
  patternsObserved: string[];
  topInsight: string;
  nextWeekRecommendation: string;
  motivationalMessage: string;
  aiMeta: AIResponseMeta;
}

export interface RiskExplanationResponse {
  explanation: string; // 2-3 sentences in plain English
  primaryFactor: string; // single biggest contributor
  suggestedAction: string; // one specific actionable next step
  aiMeta: AIResponseMeta;
}

export interface GmailSuggestionResponse {
  gmailMessageId: string;
  subject: string;
  from: string;
  extractedTitle: string;
  extractedDeadline: string | null; // ISO 8601
  extractedEffort: number | null;
  extractedDomain: 'academic' | 'work' | 'personal' | 'health' | 'social' | 'family';
  confidence: number;
  reasoning?: string;
}
