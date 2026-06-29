import { create } from "zustand";
import { UserProfile } from "@/lib/types/user";
import { auth } from "@/lib/firebase/client";
import { db } from "@/lib/firebase/client";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  User as FirebaseUser,
} from "firebase/auth";
import { doc, onSnapshot, Unsubscribe } from "firebase/firestore";

interface UserState {
  user: FirebaseUser | null;
  userProfile: UserProfile | null;
  profileLoading: boolean;
  loading: boolean;
  error: string | null;

  setUser: (user: FirebaseUser | null) => void;
  subscribeToUserProfile: (userId: string) => Unsubscribe;
  clearUser: () => void;
  setError: (error: string | null) => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  userProfile: null,
  profileLoading: false,
  loading: false,
  error: null,

  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),

  subscribeToUserProfile: (userId: string): Unsubscribe => {
    set({ profileLoading: true, error: null });

    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          
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

          const profile: UserProfile = {
            uid: snapshot.id,
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
              lastUpdated: toISO(data.learningCoefficients?.lastUpdated),
            },
            stats: {
              stressScore: Number(data.stats?.stressScore ?? 0),
              stressScoreComputedAt: toISONullable(data.stats?.stressScoreComputedAt),
              currentStreak: Number(data.stats?.currentStreak ?? 0),
              longestStreak: Number(data.stats?.longestStreak ?? 0),
              totalCommitmentsCreated: Number(data.stats?.totalCommitmentsCreated ?? 0),
              totalCompleted: Number(data.stats?.totalCompleted ?? 0),
              totalMissed: Number(data.stats?.totalMissed ?? 0),
            },
            calendarLastFetchedAt: toISONullable(data.calendarLastFetchedAt),
            lastReflectionGeneratedAt: toISONullable(data.lastReflectionGeneratedAt),
            lastWeeklyPlan: toISONullable(data.lastWeeklyPlan),

            // Backward compatibility fields
            googleRefreshToken: data.googleRefreshToken || data.googleCalendarRefreshToken || "",
            googleAccessToken: data.googleAccessToken || "",
            createdAt: toISO(data.createdAt || new Date()),
            lastActiveAt: toISO(data.lastActiveAt || new Date()),
            longTermGoalsReviewedAt: toISONullable(data.longTermGoalsReviewedAt),
          };
          set({ userProfile: profile, profileLoading: false });
        } else {
          set({ userProfile: null, profileLoading: false });
        }
      },
      (err) => {
        if (err.code === "permission-denied") {
          set({ profileLoading: false });
          return;
        }
        console.error("[useUserStore] subscribeToUserProfile error:", err.message);
        set({ error: err.message, profileLoading: false });
      }
    );
    return unsubscribe;
  },

  clearUser: () => {
    set({ user: null, userProfile: null, profileLoading: false, loading: false, error: null });
  },

  login: async () => {
    set({ loading: true, error: null });
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("email");
      provider.addScope("profile");
      provider.addScope("https://www.googleapis.com/auth/calendar");
      provider.addScope("https://www.googleapis.com/auth/gmail.readonly");

      provider.setCustomParameters({
        prompt: "consent",
        access_type: "offline",
      });

      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);

      if (!credential) {
        throw new Error("No credentials returned from Google Sign-In");
      }

      const { accessToken } = credential;
      const userObj = result.user;
      const refreshToken = (result as any)._tokenResponse?.oauthRefreshToken || "";

      const res = await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: userObj.uid,
          email: userObj.email,
          displayName: userObj.displayName,
          photoURL: userObj.photoURL,
          accessToken,
          refreshToken,
          tokenExpiry: (userObj as any).stsTokenManager?.expirationTime,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save tokens on backend");
      }

      document.cookie = `session=${userObj.uid}; path=/; max-age=31536000; SameSite=Lax`;

      set({ user: userObj, loading: false });
    } catch (err: any) {
      console.error("Login error:", err);
      set({ error: err.message || "Failed to log in", loading: false });
      throw err;
    }
  },

  loginWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      const userObj = result.user;

      const res = await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: userObj.uid,
          email: userObj.email,
          displayName: userObj.displayName || email.split("@")[0],
          photoURL: userObj.photoURL || "",
          accessToken: "",
          refreshToken: "",
          tokenExpiry: null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save tokens on backend");
      }

      document.cookie = `session=${userObj.uid}; path=/; max-age=31536000; SameSite=Lax`;

      set({ user: userObj, loading: false });
    } catch (err: any) {
      console.error("Email login error:", err);
      set({ error: err.message || "Failed to log in", loading: false });
      throw err;
    }
  },

  signUpWithEmail: async (email, password, displayName) => {
    set({ loading: true, error: null });
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      const userObj = result.user;

      await updateProfile(userObj, { displayName });

      const res = await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uid: userObj.uid,
          email: userObj.email,
          displayName,
          photoURL: "",
          accessToken: "",
          refreshToken: "",
          tokenExpiry: null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to initialize user on backend");
      }

      document.cookie = `session=${userObj.uid}; path=/; max-age=31536000; SameSite=Lax`;

      set({ user: userObj, loading: false });
    } catch (err: any) {
      console.error("Email signup error:", err);
      set({ error: err.message || "Failed to sign up", loading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await fbSignOut(auth);
      document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      set({ user: null, userProfile: null, loading: false, profileLoading: false });
    } catch (err: any) {
      console.error("Logout error:", err);
      set({ error: err.message || "Failed to log out", loading: false });
      throw err;
    }
  },
}));
