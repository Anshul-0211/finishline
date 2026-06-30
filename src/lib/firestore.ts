import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Commitment, firestoreToCommitment } from "./types/commitment";
import { UserProfile } from "./types/user";

export async function getCommitment(commitmentId: string): Promise<Commitment> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const docRef = doc(db, "users", userId, "commitments", commitmentId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`Commitment with ID ${commitmentId} not found`);
  }
  return firestoreToCommitment(docSnap);
}

export async function createCommitment(
  userId: string,
  data: Partial<Commitment>
): Promise<string> {
  const colRef = collection(db, "users", userId, "commitments");
  const docRef = await addDoc(colRef, {
    ...data,
    isDirty: true,
    createdAt: data.createdAt || serverTimestamp(),
  });
  return docRef.id;
}

export async function updateCommitment(
  commitmentId: string,
  data: Partial<Commitment>
): Promise<void> {
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error("User not authenticated");
  }
  const docRef = doc(db, "users", userId, "commitments", commitmentId);
  await updateDoc(docRef, {
    ...data,
    isDirty: true
  } as any);
}

export async function getUser(userId: string): Promise<UserProfile> {
  const docRef = doc(db, "users", userId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error(`User with ID ${userId} not found`);
  }
  const data = docSnap.data() || {};
  
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

  return {
    uid: docSnap.id,
    email: data.email || "",
    displayName: data.displayName || "",
    photoURL: data.photoURL || "",
    googleCalendarRefreshToken: data.googleCalendarRefreshToken,
    googleGmailRefreshToken: data.googleGmailRefreshToken,
    googleCalendarId: data.googleCalendarId,
    fcmToken: data.fcmToken,
    preferences: {
      timezone: data.preferences?.timezone || "UTC",
      defaultCalendarId: data.preferences?.defaultCalendarId || "primary",
      workingHours: data.preferences?.workingHours
        ? {
            start: Number(data.preferences.workingHours.start ?? 9),
            end: Number(data.preferences.workingHours.end ?? 17),
          }
        : undefined,
      defaultDomain: data.preferences?.defaultDomain || "work",
      notificationsEnabled: Boolean(data.preferences?.notificationsEnabled || false),
      fcmToken: data.preferences?.fcmToken || data.fcmToken || "",
      theme: data.preferences?.theme || "system",
    },
    learningCoefficients: {
      underestimationFactor: Number(data.learningCoefficients?.underestimationFactor ?? 1.0),
      preferredWorkHours: Array.isArray(data.learningCoefficients?.preferredWorkHours)
        ? data.learningCoefficients.preferredWorkHours.map(Number)
        : [],
      lastUpdated: toISO(data.learningCoefficients?.lastUpdated) as any,
      averageAttentionSpanMinutes: data.learningCoefficients?.averageAttentionSpanMinutes !== undefined
        ? Number(data.learningCoefficients.averageAttentionSpanMinutes)
        : undefined,
      domainEffortMultipliers: data.learningCoefficients?.domainEffortMultipliers || undefined,
    },
    stats: {
      stressScore: Number(data.stats?.stressScore ?? 0),
      stressScoreComputedAt: toISONullable(data.stats?.stressScoreComputedAt) as any,
      currentStreak: Number(data.stats?.currentStreak ?? 0),
      longestStreak: Number(data.stats?.longestStreak ?? 0),
      totalCommitmentsCreated: Number(data.stats?.totalCommitmentsCreated ?? 0),
      totalCompleted: Number(data.stats?.totalCompleted ?? 0),
      totalMissed: Number(data.stats?.totalMissed ?? 0),
      burnoutDetected: Boolean(data.stats?.burnoutDetected || false),
      burnoutLastEvaluatedAt: toISONullable(data.stats?.burnoutLastEvaluatedAt),
    },
    calendarLastFetchedAt: toISONullable(data.calendarLastFetchedAt) as any,
    lastReflectionGeneratedAt: toISONullable(data.lastReflectionGeneratedAt) as any,
    lastWeeklyPlan: data.lastWeeklyPlan || null,
    lastWeeklyPlanGeneratedAt: toISONullable(data.lastWeeklyPlanGeneratedAt) as any,
    lastWeeklyReflection: data.lastWeeklyReflection || null,
    lastWeeklyReflectionGeneratedAt: toISONullable(data.lastWeeklyReflectionGeneratedAt) as any,

    // Backward compatibility fields
    googleRefreshToken: data.googleRefreshToken || data.googleCalendarRefreshToken || "",
    googleAccessToken: data.googleAccessToken || "",
    createdAt: toISO(data.createdAt || new Date()) as any,
    lastActiveAt: toISO(data.lastActiveAt || new Date()) as any,
    longTermGoalsReviewedAt: toISONullable(data.longTermGoalsReviewedAt) as any,
  };
}

export async function updateUser(
  userId: string,
  data: Partial<UserProfile>
): Promise<void> {
  const docRef = doc(db, "users", userId);
  await updateDoc(docRef, data as any);
}
