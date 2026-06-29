import { DocumentSnapshot } from "firebase/firestore";

export interface FirestoreTimestamp {
  toDate(): Date;
  seconds: number;
  nanoseconds: number;
}

export type FirestoreDate = string | Date | FirestoreTimestamp;

declare global {
  interface String {
    toDate?(): Date;
    seconds?: number;
    nanoseconds?: number;
  }
  interface Date {
    toDate?(): Date;
    seconds?: number;
    nanoseconds?: number;
  }
}

export interface ScheduledBlock {
  startTime?: FirestoreDate; // Made optional for compatibility
  endTime?: FirestoreDate;   // Made optional for compatibility
  start: FirestoreDate;     // Backward compatibility
  end: FirestoreDate;       // Backward compatibility
  goal?: string;             // Made optional for compatibility
  calendarEventId?: string;  // Backward compatibility
}

export interface ActionPlanStep {
  id: string;
  title: string;
  estimatedMinutes: number;
  suggestedTimeSlot?: string;
  cognitiveIntensity?: "low" | "medium" | "high";
  notes?: string;
  completed: boolean;
  completedAt?: FirestoreDate | null; // Backward compatibility
}

export interface ActionPlan {
  steps: ActionPlanStep[];
  totalMinutes?: number; // Made optional for compatibility
  generatedAt: FirestoreDate; // ISO 8601 string or Date or Timestamp
}

export interface RenegotiationEntry {
  at: FirestoreDate; // ISO 8601 string or Date or Timestamp
  failureReason: string;
  outcome: string;
  oldDeadline: FirestoreDate; // ISO 8601 string or Date or Timestamp
  newDeadline: FirestoreDate; // ISO 8601 string or Date or Timestamp
}

export interface Commitment {
  id: string;
  userId?: string;
  title: string;
  description: string;
  domain: "academic" | "work" | "personal" | "health" | "social" | "family";
  deadline: FirestoreDate; // ISO 8601 string or Date or Timestamp
  isLongTermGoal: boolean;
  effortEstimateHours: number;
  priority?: "critical" | "high" | "medium" | "low";
  difficulty?: "easy" | "medium" | "hard";
  estimatedCognitiveLoad?: "low" | "medium" | "high";
  commitmentType?: string;
  recommendedSessions?: number;
  stakeholderImportance?: "low" | "medium" | "high";
  status: "active" | "completed" | "missed" | "deferred" | "renegotiating" | "snoozed";
  completionPercentage: number;
  createdAt: FirestoreDate; // ISO 8601 string or Date or Timestamp
  completedAt?: FirestoreDate | null; // Made optional
  lastProgressAt?: FirestoreDate | null; // Made optional
  daysSinceLastProgress?: number;
  riskScore?: number;
  riskTrend?: "improving" | "stable" | "worsening";
  probability?: number;
  riskUpdatedAt?: FirestoreDate | null; // Made optional and nullable for test compatibility
  scheduledBlocks?: ScheduledBlock[];
  calendarEventIds?: string[];
  hasCollision?: boolean;
  collisionDetails?: string | null;
  collisionUpdatedAt?: FirestoreDate | null; // Made optional
  nextCheckInAt?: FirestoreDate | null; // Made optional
  lastCheckInSentAt?: FirestoreDate | null; // Made optional
  actionPlan: ActionPlan | null;
  renegotiationHistory?: RenegotiationEntry[];

  // Backward compatibility fields (non-optional to satisfy strictNullChecks in backend code)
  adjustedEffortHours: number;
  completedEffortHours: number;
  lastCheckInAt: FirestoreDate | null;
  lastResurfacedAt: FirestoreDate | null;
  updatedAt: FirestoreDate;
  tags: string[];
  extractedByAI: boolean;
  extractionConfidence: number;
  source: "text" | "pdf" | "image" | "voice" | "gmail" | "manual";
  sourceFileUrl: string | null;
  gmailMessageId: string | null;

  // Backward compatibility fields
  probabilityCurrentPath?: number;
  probabilityRecommendedPath?: number;
  checkInHistory?: CheckInHistoryEntry[];
}

export interface CheckInHistoryEntry {
  timestamp: FirestoreDate;
  wasOnTrack: boolean;
  failureReason: string | null;
  completionAtCheckIn: number;
}

export function firestoreToCommitment(doc: DocumentSnapshot): Commitment {
  const data = doc.data();
  if (!data) {
    throw new Error(`Document ${doc.id} contains no data`);
  }

  // Helper: convert Firebase Timestamps (or string/Date) to ISO strings
  const toISO = (val: any): string => {
    if (!val) return "";
    if (typeof val.toDate === "function") {
      return val.toDate().toISOString();
    }
    if (val instanceof Date) {
      return val.toISOString();
    }
    if (typeof val === "string") {
      return new Date(val).toISOString();
    }
    return "";
  };

  const toISONullable = (val: any): string | null => {
    const iso = toISO(val);
    return iso || null;
  };

  const scheduledBlocks = Array.isArray(data.scheduledBlocks)
    ? data.scheduledBlocks.map((b: any) => ({
        startTime: toISO(b.startTime || b.start) as any,
        endTime: toISO(b.endTime || b.end) as any,
        start: toISO(b.start || b.startTime) as any,
        end: toISO(b.end || b.endTime) as any,
        goal: b.goal || "",
        calendarEventId: b.calendarEventId || "",
      }))
    : [];

  const actionPlan = data.actionPlan
    ? {
        steps: Array.isArray(data.actionPlan.steps)
          ? data.actionPlan.steps.map((s: any) => ({
              id: s.id || "",
              title: s.title || "",
              estimatedMinutes: Number(s.estimatedMinutes || 0),
              suggestedTimeSlot: s.suggestedTimeSlot || undefined,
              cognitiveIntensity: s.cognitiveIntensity || undefined,
              notes: s.notes || undefined,
              completed: Boolean(s.completed || false),
              completedAt: s.completedAt ? (toISO(s.completedAt) as any) : null,
            }))
          : [],
        totalMinutes: Number(data.actionPlan.totalMinutes || 0),
        generatedAt: toISO(data.actionPlan.generatedAt) as any,
      }
    : null;

  const renegotiationHistory = Array.isArray(data.renegotiationHistory)
    ? data.renegotiationHistory.map((r: any) => ({
        at: toISO(r.at) as any,
        failureReason: r.failureReason || "",
        outcome: r.outcome || "",
        oldDeadline: toISO(r.oldDeadline) as any,
        newDeadline: toISO(r.newDeadline) as any,
      }))
    : [];

  const checkInHistory = Array.isArray(data.checkInHistory)
    ? data.checkInHistory.map((h: any) => ({
        timestamp: toISO(h.timestamp) as any,
        wasOnTrack: Boolean(h.wasOnTrack),
        failureReason: h.failureReason || null,
        completionAtCheckIn: Number(h.completionAtCheckIn || 0),
      }))
    : undefined;

  return {
    id: doc.id,
    userId: data.userId || "",
    title: data.title || "",
    description: data.description || "",
    domain: data.domain || "work",
    deadline: toISO(data.deadline) as any,
    isLongTermGoal: Boolean(data.isLongTermGoal || false),
    effortEstimateHours: Number(data.effortEstimateHours || 0),
    priority: data.priority || "medium",
    difficulty: data.difficulty || "medium",
    estimatedCognitiveLoad: data.estimatedCognitiveLoad || "medium",
    commitmentType: data.commitmentType || "",
    recommendedSessions: Number(data.recommendedSessions || 0),
    stakeholderImportance: data.stakeholderImportance || "medium",
    status: data.status || "active",
    completionPercentage: Number(data.completionPercentage || 0),
    createdAt: toISO(data.createdAt) as any,
    completedAt: toISONullable(data.completedAt) as any,
    lastProgressAt: toISONullable(data.lastProgressAt) as any,
    daysSinceLastProgress: Number(data.daysSinceLastProgress || 0),
    riskScore: Number(data.riskScore || 0),
    riskTrend: data.riskTrend || "stable",
    probability: Number(data.probability || 0),
    riskUpdatedAt: toISONullable(data.riskUpdatedAt) as any,
    scheduledBlocks,
    calendarEventIds: Array.isArray(data.calendarEventIds) ? data.calendarEventIds : [],
    hasCollision: Boolean(data.hasCollision || false),
    collisionDetails: data.collisionDetails || null,
    collisionUpdatedAt: toISONullable(data.collisionUpdatedAt) as any,
    nextCheckInAt: toISO(data.nextCheckInAt) as any,
    lastCheckInSentAt: toISONullable(data.lastCheckInSentAt) as any,
    actionPlan,
    renegotiationHistory,

    // Backward compatibility fields mapped from doc (ensuring default values)
    adjustedEffortHours: data.adjustedEffortHours !== undefined ? Number(data.adjustedEffortHours) : Number(data.effortEstimateHours || 0),
    completedEffortHours: Number(data.completedEffortHours || 0),
    lastCheckInAt: data.lastCheckInAt ? (toISO(data.lastCheckInAt) as any) : null,
    lastResurfacedAt: data.lastResurfacedAt ? (toISO(data.lastResurfacedAt) as any) : null,
    updatedAt: toISO(data.updatedAt || data.createdAt) as any,
    tags: Array.isArray(data.tags) ? data.tags : [],
    extractedByAI: data.extractedByAI !== undefined ? Boolean(data.extractedByAI) : false,
    extractionConfidence: data.extractionConfidence !== undefined ? Number(data.extractionConfidence) : 1.0,
    source: data.source || "manual",
    sourceFileUrl: data.sourceFileUrl || null,
    gmailMessageId: data.gmailMessageId || null,
    checkInHistory,
  };
}
