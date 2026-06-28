import { create } from "zustand";
import { User as UserProfile } from "@/lib/types";
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
  loading: boolean;
  error: string | null;
  setUser: (user: FirebaseUser | null) => void;
  setUserProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  subscribeToUserProfile: (userId: string) => Unsubscribe;
}

export const useUserStore = create<UserState>((set) => ({
  user: null,
  userProfile: null,
  loading: false,
  error: null,
  setUser: (user) => set({ user }),
  setUserProfile: (userProfile) => set({ userProfile }),
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
      set({ user: null, userProfile: null, loading: false });
    } catch (err: any) {
      console.error("Logout error:", err);
      set({ error: err.message || "Failed to log out", loading: false });
      throw err;
    }
  },

  subscribeToUserProfile: (userId: string): Unsubscribe => {
    const userRef = doc(db, "users", userId);
    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          set({ userProfile: snapshot.data() as UserProfile });
        } else {
          set({ userProfile: null });
        }
      },
      (err) => {
        if (err.code === "permission-denied") {
          return;
        }
        console.error("[useUserStore] subscribeToUserProfile error:", err.message);
      }
    );
    return unsubscribe;
  },
}));
