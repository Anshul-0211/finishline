import { adminDb } from "@/lib/firebase/admin";
import { User, Commitment, Renegotiation } from "@/lib/types";
import { CoreLifeContext, ExtendedLifeContext } from "../types/lifeContext";
import { TimeSlot } from "./types";
import { computeDomainBalance } from "../utils/domain";
import { computeCompletionRate, computeMostProductiveDomain, computeCommonFailureReason } from "../utils/stats";

export type { CoreLifeContext, ExtendedLifeContext };

function createDefaultUser(userId: string): User {
  const now = new Date().toISOString();
  return {
    uid: userId,
    email: "",
    displayName: "FinishLine User",
    photoURL: "",
    googleCalendarRefreshToken: "false",
    googleGmailRefreshToken: "false",
    googleRefreshToken: "",
    googleAccessToken: "",
    createdAt: now,
    lastActiveAt: now,
    preferences: {
      timezone: "Asia/Kolkata",
      workingHours: { start: 9, end: 17 },
      defaultDomain: "personal",
      notificationsEnabled: false,
      fcmToken: "",
      theme: "dark"
    },
    learningCoefficients: {
      underestimationFactor: 1.2,
      preferredWorkHours: [9, 10, 11, 14, 15, 16],
      lastUpdated: null,
      averageAttentionSpanMinutes: 45,
      avgProcrastinationBuffer: 15
    },
    stats: {
      stressScore: 0,
      currentStreak: 0,
      longestStreak: 0,
      totalCommitmentsCreated: 0,
      totalCompleted: 0,
      totalMissed: 0
    }
  };
}

export async function getUser(userId: string): Promise<User> {
  const snap = await adminDb.collection("users").doc(userId).get();
  if (!snap.exists) {
    const defaultUser = createDefaultUser(userId);
    await adminDb.collection("users").doc(userId).set(defaultUser);
    return defaultUser;
  }
  return snap.data() as User;
}


async function getActiveCommitments(userId: string): Promise<Commitment[]> {
  const snap = await adminDb.collection("users").doc(userId).collection("commitments")
    .where("status", "in", ["active", "renegotiating"])
    .get();
  return snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Commitment));
}

export async function getCalendarFreeSlots(
  userId: string,
  options: { days: number; minSlotMinutes?: number }
): Promise<TimeSlot[] & { _fetchedAt?: string }> {
  const now = new Date();
  const { days, minSlotMinutes = 30 } = options;

  // Helper: convert a DateInput to milliseconds
  function toMs(val: string | number | Date): number {
    if (val instanceof Date) return val.getTime();
    if (typeof val === "number") return val;
    return new Date(val).getTime();
  }

  // Default fallback: 14:00–17:00 each day (used if Calendar is not connected)
  function mockSlots(): TimeSlot[] & { _fetchedAt?: string } {
    const slots: TimeSlot[] = [];
    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(now.getDate() + i);
      const start = new Date(day);
      start.setHours(14, 0, 0, 0);
      const end = new Date(day);
      end.setHours(17, 0, 0, 0);
      slots.push({ start: start.toISOString(), end: end.toISOString() });
    }
    const result = slots as TimeSlot[] & { _fetchedAt?: string };
    result._fetchedAt = now.toISOString();
    return result;
  }

  try {
    // 1. Load user preferences for working hours
    const { getCalendarClient } = await import("@/lib/services/calendar");
    const { adminDb } = await import("@/lib/firebase/admin");
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) return mockSlots();

    const user = userDoc.data() as import("@/lib/types").User;
    const workStart: number = user.preferences?.workingHours?.start ?? 9;
    const workEnd: number = user.preferences?.workingHours?.end ?? 18;

    // 2. Query Google Calendar freeBusy for the date range
    const rangeStart = new Date(now);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(now);
    rangeEnd.setDate(now.getDate() + days);
    rangeEnd.setHours(23, 59, 59, 999);

    const calendar = await getCalendarClient(userId);
    const freeBusyRes = await calendar.freebusy.query({
      requestBody: {
        timeMin: rangeStart.toISOString(),
        timeMax: rangeEnd.toISOString(),
        items: [{ id: "primary" }],
      },
    });
    const rawBusy = freeBusyRes.data.calendars?.primary?.busy ?? [];
    const busyPeriods: TimeSlot[] = rawBusy.map((b) => ({
      start: b.start ?? "",
      end: b.end ?? "",
    }));

    // 3. Subtract busy periods from working hours to compute free slots
    const freeSlots: TimeSlot[] = [];

    for (let i = 0; i < days; i++) {
      const day = new Date(now);
      day.setDate(now.getDate() + i);

      const dayStart = new Date(day);
      dayStart.setHours(workStart, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(workEnd, 0, 0, 0);

      // Today: start from current time, rounded up to next 30-min boundary
      let cursor =
        i === 0 && now > dayStart ? new Date(now) : new Date(dayStart);
      if (i === 0 && now > dayStart) {
        const mins = cursor.getMinutes();
        cursor.setMinutes(Math.ceil(mins / 30) * 30, 0, 0);
      }

      // Busy blocks that overlap this working window, sorted by start
      const dayBusy = busyPeriods
        .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
        .filter((b) => b.end > dayStart && b.start < dayEnd)
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      for (const busy of dayBusy) {
        const bStart = busy.start < dayStart ? dayStart : busy.start;
        const bEnd = busy.end > dayEnd ? dayEnd : busy.end;
        if (cursor < bStart) {
          const durMs = toMs(bStart) - toMs(cursor);
          if (durMs >= minSlotMinutes * 60_000) {
            freeSlots.push({
              start: cursor.toISOString(),
              end: bStart.toISOString(),
            });
          }
        }
        if (bEnd > cursor) cursor = new Date(bEnd);
      }

      // Remaining time after last busy block
      if (cursor < dayEnd) {
        const durMs = toMs(dayEnd) - toMs(cursor);
        if (durMs >= minSlotMinutes * 60_000) {
          freeSlots.push({
            start: cursor.toISOString(),
            end: dayEnd.toISOString(),
          });
        }
      }
    }

    const result = freeSlots as TimeSlot[] & { _fetchedAt?: string };
    result._fetchedAt = now.toISOString();
    return result;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[context] getCalendarFreeSlots failed (${msg}) — falling back to mock slots`
    );
    return mockSlots();
  }
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
    timezone: ((user.preferences as unknown as Record<string, unknown>)?.timezone as string) || (typeof Intl !== "undefined" && Intl.DateTimeFormat().resolvedOptions().timeZone) || "Asia/Kolkata",
    availableSlotsThisWeek: calendarSlots,
    preferredWorkHours: user.learningCoefficients?.preferredWorkHours || [9, 10, 14, 15, 20, 21],
    underestimationFactor: user.learningCoefficients?.underestimationFactor || 1.0,
    domainEffortMultipliers: user.learningCoefficients?.domainEffortMultipliers || {
      work: 1.0,
      academic: 1.0,
      personal: 1.0,
      health: 1.0
    },
    averageAttentionSpanMinutes: user.learningCoefficients?.averageAttentionSpanMinutes || 45,
    activeCommitments: commitments.map(c => ({
      id: c.id,
      title: c.title,
      domain: c.domain,
      deadline: (c.deadline as any) instanceof Date 
        ? (c.deadline as any).toISOString() 
        : ((c.deadline as any)?.toDate?.() ? (c.deadline as any).toDate().toISOString() : (c.deadline as any) || now),
      riskScore: c.riskScore || 0,
      riskTrend: c.riskTrend || 'stable',
      completionPercentage: c.completionPercentage || 0,
      remainingEffortHours: (c.adjustedEffortHours || c.effortEstimateHours || 0) * (1 - (c.completionPercentage || 0) / 100),
      scheduledBlocks: (c.scheduledBlocks || []).map((b: any) => ({
        start: (b.start as any)?.toDate?.() ? (b.start as any).toDate().toISOString() : (b.start as any),
        end: (b.end as any)?.toDate?.() ? (b.end as any).toDate().toISOString() : (b.end as any),
        calendarEventId: b.calendarEventId,
      })),
      priority: c.priority || "medium",
    })),
    stressScore: user.stats?.stressScore || 0,
    totalActiveCommitments: commitments.length,
    domainBalanceMetrics: computeDomainBalance(commitments),
    _meta: {
      calendarFetchedAt: calendarSlots._fetchedAt || now,
      commitmentsSyncedAt: now,
      stressScoreComputedAt: (user.stats?.stressScoreComputedAt as any)?.toDate?.() 
        ? (user.stats.stressScoreComputedAt as any).toDate().toISOString() 
        : ((user.stats?.stressScoreComputedAt as any) instanceof Date 
          ? (user.stats.stressScoreComputedAt as any).toISOString() 
          : now),
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

  const completedCommitments: { id: string; title: string; domain: string; actualEffortHours: number }[] = [];
  const missedCommitments: { id: string; title: string; reason: string | null }[] = [];
  let actualEffortHours = 0;
  let estimatedEffortHours = 0;

  commitmentsSnap.docs.forEach((doc: any) => {
    const c = doc.data() as Commitment;
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
        reason: (c as unknown as Record<string, unknown>).failureReason as string | null || null,
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
  return snap.docs.map((doc: any) => {
    const c = doc.data() as Commitment;
    return {
      id: doc.id,
      title: c.title,
      domain: c.domain,
      lastResurfacedAt: (c.lastResurfacedAt as any)?.toDate?.() 
        ? (c.lastResurfacedAt as any).toDate().toISOString() 
        : (c.lastResurfacedAt as any) || null,
    };
  });
}

async function getRecentRenegotiations(userId: string, options: { weeks: number }) {
  const pastDate = new Date();
  pastDate.setDate(pastDate.getDate() - (options.weeks * 7));
  
  const snap = await adminDb.collection("users").doc(userId).collection("renegotiations")
    .get();
    
  return snap.docs.map((doc: any) => {
    const r = doc.data() as Renegotiation;
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
    burnoutDetected: user.stats?.burnoutDetected || false,
    recentCompletionRate: computeCompletionRate(user, { weeks: 4 }),
    avgUnderestimation: user.learningCoefficients?.underestimationFactor || 1.0,
    mostProductiveDomain: computeMostProductiveDomain(user),
    commonFailureReason: computeCommonFailureReason(renegotiations),
    pastWeek,
    longTermGoals,
    recentRenegotiations: renegotiations,
    currentStreak: user.stats?.currentStreak || 0,
    longestStreak: user.stats?.longestStreak || 0,
    _meta: {
      ...core._meta,
      reflectionGeneratedAt: (user.lastReflectionGeneratedAt as any)?.toDate?.()
        ? (user.lastReflectionGeneratedAt as any).toDate().toISOString()
        : null,
      longTermGoalsReviewedAt: (user.longTermGoalsReviewedAt as any)?.toDate?.()
        ? (user.longTermGoalsReviewedAt as any).toDate().toISOString()
        : null,
      learningCoefficientsUpdatedAt: (user.learningCoefficients?.lastUpdated as any)?.toDate?.()
        ? (user.learningCoefficients.lastUpdated as any).toDate().toISOString()
        : new Date().toISOString(),
    },
  };
}
