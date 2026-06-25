import { create } from "zustand";
import { User } from "@/lib/types";
import { auth } from "@/lib/firebase/client";
import { GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";

interface UserState {
  user: User | null;
  loading: boolean;
  error: string | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),

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
      const refreshToken = (userObj as any).stsTokenManager?.refreshToken || "";

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

      const mappedUser: User = {
        uid: userObj.uid,
        email: userObj.email || "",
        displayName: userObj.displayName || "",
        photoURL: userObj.photoURL || "",
        googleAccessToken: "",
        googleRefreshToken: "",
        tokenExpiry: null,
        preferences: {
          defaultDomain: "personal",
          workingHours: { start: 9, end: 18 },
          theme: "system",
          notificationsEnabled: true,
          fcmToken: "",
        },
        learningCoefficients: {
          underestimationFactor: 1.0,
          preferredWorkHours: [9, 10, 14, 15, 20, 21],
          avgProcrastinationBuffer: 2.0,
          lastUpdated: null,
        },
        stats: {
          totalCommitmentsCreated: 0,
          totalCompleted: 0,
          totalMissed: 0,
          currentStreak: 0,
          longestStreak: 0,
          stressScore: 0,
        },
        createdAt: null,
        lastActiveAt: null,
      };

      set({ user: mappedUser, loading: false });
    } catch (err: any) {
      console.error("Login error:", err);
      set({ error: err.message || "Failed to log in", loading: false });
      throw err;
    }
  },

  logout: async () => {
    set({ loading: true });
    try {
      await fbSignOut(auth);
      document.cookie = "session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
      set({ user: null, loading: false });
    } catch (err: any) {
      console.error("Logout error:", err);
      set({ error: err.message || "Failed to log out", loading: false });
      throw err;
    }
  },
}));
