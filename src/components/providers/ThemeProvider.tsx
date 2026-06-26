"use client";

import { useAtom } from "jotai";
import { themeAtom } from "@/lib/atoms/themeAtom";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import { useUserStore } from "@/lib/stores/useUserStore";

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme] = useAtom(themeAtom);

  // Restore session / user details on reload or auth change
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        let userData: any = null;
        try {
          const userDocRef = doc(db, "users", firebaseUser.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            userData = docSnap.data();
          }
        } catch (err) {
          console.error("Failed to fetch user data on auth change:", err);
        }

        const mappedUser = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || "",
          displayName: firebaseUser.displayName || userData?.displayName || "",
          photoURL: firebaseUser.photoURL || userData?.photoURL || "",
          googleAccessToken: "",
          googleRefreshToken: "",
          tokenExpiry: null,
          preferences: userData?.preferences || {
            defaultDomain: "personal",
            workingHours: { start: 9, end: 18 },
            theme: "system",
            notificationsEnabled: true,
            fcmToken: "",
          },
          learningCoefficients: userData?.learningCoefficients || {
            underestimationFactor: 1.0,
            preferredWorkHours: [9, 10, 14, 15, 20, 21],
            avgProcrastinationBuffer: 2.0,
            lastUpdated: null,
          },
          stats: userData?.stats || {
            totalCommitmentsCreated: 0,
            totalCompleted: 0,
            totalMissed: 0,
            currentStreak: 0,
            longestStreak: 0,
            stressScore: 0,
          },
          createdAt: userData?.createdAt || null,
          lastActiveAt: userData?.lastActiveAt || null,
        };
        useUserStore.getState().setUser(mappedUser);
      } else {
        useUserStore.getState().setUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (t: "light" | "dark" | "system") => {
      root.classList.remove("light", "dark");

      if (t === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(t);
      }
    };

    applyTheme(theme);

    // Add media query listener for system prefers-color-scheme
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return <>{children}</>;
}
