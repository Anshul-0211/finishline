import { adminDb } from "@/lib/firebase/admin";
import { User } from "@/lib/types";
import { CoreLifeContext, ExtendedLifeContext, TimeSlot } from "./types";

async function getUser(userId: string): Promise<User> {
  const snap = await adminDb.collection("users").doc(userId).get();
  if (!snap.exists) {
    throw new Error(`User document ${userId} not found`);
  }
  return snap.data() as User;
}

async function getActiveCommitments(userId: string): Promise<any[]> {
  const snap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("status", "in", ["active", "renegotiating"])
    .get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getCalendarFreeSlots(userId: string, options: { days: number }): Promise<TimeSlot[] & { _fetchedAt?: string }> {
  // Mock calendar fetch for local scaffold development
  const slots: TimeSlot[] = [];
  const now = new Date();
  for (let i = 0; i < options.days; i++) {
    const day = new Date(now);
    day.setDate(now.getDate() + i);
    const start = new Date(day);
    start.setHours(14, 0, 0, 0);
    const end = new Date(day);
    end.setHours(17, 0, 0, 0);
    slots.push({
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
  const result = slots as any;
  result._fetchedAt = now.toISOString();
  return result;
}

function computeDomainBalance(commitments: any[]): Record<string, number> {
  const balance: Record<string, number> = {
    academic: 0, work: 0, personal: 0, health: 0, social: 0, family: 0
  };
  commitments.forEach(c => {
    if (c.domain in balance) {
      balance[c.domain]++;
    }
  });
  return balance;
}

export async function assembleCoreContext(userId: string): Promise<CoreLifeContext> {
  const [user, commitments, calendarSlots] = await Promise.all([
    getUser(userId),
    getActiveCommitments(userId),
    getCalendarFreeSlots(userId, { days: 7 }),
  ]);

  const now = new Date().toISOString();

  return {
    userId,
    currentDateTime: now,
    timezone: user.preferences?.theme || "UTC", // theme or timezone field if available, fallback to UTC
    availableSlotsThisWeek: calendarSlots,
    preferredWorkHours: user.learningCoefficients?.preferredWorkHours || [9, 10, 14, 15, 20, 21],
    underestimationFactor: user.learningCoefficients?.underestimationFactor || 1.0,
    activeCommitments: commitments.map(c => ({
      id: c.id,
      title: c.title,
      domain: c.domain,
      deadline: c.deadline instanceof Date 
        ? c.deadline.toISOString() 
        : (c.deadline?.toDate?.() ? c.deadline.toDate().toISOString() : c.deadline || now),
      riskScore: c.riskScore || 0,
      riskTrend: c.riskTrend || 'stable',
      completionPercentage: c.completionPercentage || 0,
      remainingEffortHours: (c.adjustedEffortHours || c.effortEstimateHours || 0) * (1 - (c.completionPercentage || 0) / 100),
      scheduledBlocks: (c.scheduledBlocks || []).map((b: any) => ({
        start: b.start?.toDate?.() ? b.start.toDate().toISOString() : b.start,
        end: b.end?.toDate?.() ? b.end.toDate().toISOString() : b.end,
        calendarEventId: b.calendarEventId,
      })),
    })),
    stressScore: user.stats?.stressScore || 0,
    totalActiveCommitments: commitments.length,
    domainBalanceMetrics: computeDomainBalance(commitments),
    _meta: {
      calendarFetchedAt: calendarSlots._fetchedAt || now,
      commitmentsSyncedAt: now,
      stressScoreComputedAt: user.stats?.stressScoreComputedAt?.toDate?.() 
        ? user.stats.stressScoreComputedAt.toDate().toISOString() 
        : now,
      contextAssembledAt: now,
    },
  };
}

async function getPastWeekData(userId: string) {
  const now = new Date();
  const pastWeekDate = new Date();
  pastWeekDate.setDate(now.getDate() - 7);

  const commitmentsSnap = await adminDb.collection("users").doc(userId).collection("commitments")
    .get();

  const completedCommitments: any[] = [];
  const missedCommitments: any[] = [];
  let actualEffortHours = 0;
  let estimatedEffortHours = 0;

  commitmentsSnap.docs.forEach(doc => {
    const c = doc.data();
    if (c.status === "completed") {
      completedCommitments.push({
        id: doc.id,
        title: c.title,
        domain: c.domain,
        actualEffortHours: c.completedEffortHours || 0,
      });
      actualEffortHours += c.completedEffortHours || 0;
      estimatedEffortHours += c.effortEstimateHours || 0;
    } else if (c.status === "missed") {
      missedCommitments.push({
        id: doc.id,
        title: c.title,
        reason: c.failureReason || null,
      });
      estimatedEffortHours += c.effortEstimateHours || 0;
    }
  });

  return {
    completedCommitments,
    missedCommitments,
    checkinsResponded: completedCommitments.length,
    totalCheckins: completedCommitments.length + missedCommitments.length,
    actualEffortHours,
    estimatedEffortHours,
  };
}

async function getLongTermGoals(userId: string) {
  const snap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("isLongTermGoal", "==", true)
    .where("status", "==", "active")
    .get();
  return snap.docs.map(doc => {
    const c = doc.data();
    return {
      id: doc.id,
      title: c.title,
      domain: c.domain,
      lastResurfacedAt: c.lastResurfacedAt?.toDate?.() 
        ? c.lastResurfacedAt.toDate().toISOString() 
        : c.lastResurfacedAt || null,
    };
  });
}

async function getRecentRenegotiations(userId: string, options: { weeks: number }) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - (options.weeks * 7));
  
  const snap = await adminDb.collection("users").doc(userId).collection("renegotiations")
    .get();
    
  return snap.docs.map(doc => {
    const r = doc.data();
    return {
      commitmentTitle: r.userMessage || "Commitment",
      failureReason: r.failureReason || "",
      outcome: r.accepted === true ? 'accepted' as const : (r.accepted === false ? 'rejected' as const : null),
    };
  });
}

export async function assembleExtendedContext(userId: string): Promise<ExtendedLifeContext> {
  const [core, user, pastWeek, longTermGoals, renegotiations] = await Promise.all([
    assembleCoreContext(userId),
    getUser(userId),
    getPastWeekData(userId),
    getLongTermGoals(userId),
    getRecentRenegotiations(userId, { weeks: 4 }),
  ]);

  return {
    ...core,
    recentCompletionRate: user.stats?.totalCommitmentsCreated 
      ? (user.stats.totalCompleted / user.stats.totalCommitmentsCreated) * 100 
      : 100,
    avgUnderestimation: user.learningCoefficients?.underestimationFactor || 1.0,
    mostProductiveDomain: "work",
    commonFailureReason: renegotiations.length > 0 ? renegotiations[0].failureReason : "none",
    pastWeek,
    longTermGoals,
    recentRenegotiations: renegotiations,
    currentStreak: user.stats?.currentStreak || 0,
    longestStreak: user.stats?.longestStreak || 0,
    _meta: {
      ...core._meta,
      reflectionGeneratedAt: user.lastReflectionGeneratedAt?.toDate?.()
        ? user.lastReflectionGeneratedAt.toDate().toISOString()
        : null,
      longTermGoalsReviewedAt: user.longTermGoalsReviewedAt?.toDate?.()
        ? user.longTermGoalsReviewedAt.toDate().toISOString()
        : null,
      learningCoefficientsUpdatedAt: user.learningCoefficients?.lastUpdated?.toDate?.()
        ? user.learningCoefficients.lastUpdated.toDate().toISOString()
        : new Date().toISOString(),
    },
  };
}
