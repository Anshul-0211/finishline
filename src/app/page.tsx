"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Flag, Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { PillButton } from "@/components/ui/pill-button";
import { FADE_SLIDE } from "@/lib/motion";
import { auth } from "@/lib/firebase";
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  onAuthStateChanged 
} from "firebase/auth";

const GoogleIcon = () => (
  <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);

  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user) {
        document.cookie = `session=${user.uid}; path=/; max-age=31536000; SameSite=Lax`;
        router.push("/dashboard");
      }
    });
    return () => unsub();
  }, [router]);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/calendar");
      provider.addScope("https://www.googleapis.com/auth/gmail.readonly");
      
      provider.setCustomParameters({
        prompt: "consent",
        access_type: "offline",
      });

      const result = await signInWithPopup(auth, provider);
      const userObj = result.user;
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const oauthToken = credential?.accessToken || "";
      const idToken = await userObj.getIdToken();

      await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: userObj.uid,
          email: userObj.email,
          displayName: userObj.displayName,
          photoURL: userObj.photoURL,
          calendarRefreshToken: oauthToken,
          gmailRefreshToken: oauthToken,
        }),
      });

      document.cookie = `session=${userObj.uid}; path=/; max-age=31536000; SameSite=Lax`;
      router.push("/dashboard");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Sign in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please fill in both email and password fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let userObj;
      if (isSignUp) {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        userObj = result.user;
      } else {
        const result = await signInWithEmailAndPassword(auth, email, password);
        userObj = result.user;
      }

      const idToken = await userObj.getIdToken();

      await fetch("/api/auth/save-tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          userId: userObj.uid,
          email: userObj.email,
          displayName: userObj.displayName || email.split("@")[0],
          photoURL: userObj.photoURL || "",
          calendarRefreshToken: "",
          gmailRefreshToken: "",
        }),
      });

      document.cookie = `session=${userObj.uid}; path=/; max-age=31536000; SameSite=Lax`;
      router.push("/dashboard");
    } catch (e: any) {
      console.error(e);
      setError(e.message ?? "Authentication failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen relative flex flex-col items-center justify-center bg-background px-6 overflow-hidden transition-colors duration-200">
      {/* Radial Glow bloom */}
      <motion.div
        animate={{ scale: [1, 1.04, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute w-[400px] h-[400px] bg-primary/6 dark:bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2 pointer-events-none"
      />

      {/* Hero container */}
      <motion.div
        variants={FADE_SLIDE}
        initial="hidden"
        animate="visible"
        className="w-full max-w-[360px] flex flex-col items-center text-center z-10 space-y-8"
      >
        {/* App Title & Header */}
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-md mb-4 text-on-primary">
            <Flag className="w-6 h-6" />
          </div>
          <h1 className="text-[32px] font-bold text-on-surface font-sans tracking-tight leading-none">
            FinishLine
          </h1>
          <p className="text-[18px] text-on-surface-variant font-sans mt-3">
            Your AI-powered commitment engine
          </p>
        </div>

        {/* Primary CTA Cluster */}
        <div className="w-full flex flex-col items-center space-y-4">
          <PillButton
            variant="primary"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-60 h-[52px] text-[16px] font-semibold tracking-wide flex items-center justify-center"
          >
            {loading && !showEmailForm ? (
              <Loader2 className="w-5 h-5 animate-spin text-on-primary" />
            ) : (
              <>
                <GoogleIcon />
                <span>Sign in with Google</span>
              </>
            )}
          </PillButton>

          {/* Email toggle trigger */}
          <button
            onClick={() => {
              setShowEmailForm(!showEmailForm);
              setError(null);
            }}
            className="text-[12px] font-semibold font-label text-outline hover:text-on-surface-variant transition-colors duration-200 outline-none uppercase tracking-widest mt-2"
          >
            or continue with email
          </button>
        </div>

        {/* Email form expand wrapper */}
        <AnimatePresence>
          {showEmailForm && (
            <motion.form
              onSubmit={handleEmailAuth}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="w-full space-y-4 overflow-hidden mt-2 pb-1"
            >
              {/* Email Input */}
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-5 h-5 text-outline pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full pl-11 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface placeholder-text-outline text-[16px] font-sans focus:border-primary focus:ring-2 focus:ring-primary/12 focus:outline-none transition duration-200"
                  required
                  disabled={loading}
                />
              </div>

              {/* Password Input */}
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-5 h-5 text-outline pointer-events-none" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full pl-11 pr-4 h-12 bg-surface-container-lowest border border-outline-variant rounded-lg text-on-surface placeholder-text-outline text-[16px] font-sans focus:border-primary focus:ring-2 focus:ring-primary/12 focus:outline-none transition duration-200"
                  required
                  disabled={loading}
                />
              </div>

              {/* Email submit CTA and Toggle */}
              <div className="space-y-3 pt-1">
                <PillButton
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 text-[14px]"
                >
                  {loading && showEmailForm ? (
                    <Loader2 className="w-4 h-4 animate-spin text-on-primary" />
                  ) : isSignUp ? (
                    "Create Account"
                  ) : (
                    "Sign In"
                  )}
                </PillButton>

                {/* Sign-in / Sign-up state switch */}
                <button
                  type="button"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-l text-outline hover:text-on-surface-variant font-label font-semibold underline block mx-auto transition-colors"
                >
                  {isSignUp ? "Already have an account? Sign In" : "Need an account? Create Account"}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Error notification banner */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ y: -12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -12, opacity: 0 }}
              className="bg-error-container border-l-[3px] border-error text-on-error-container px-4 py-3 rounded-lg text-[12px] font-semibold font-label flex items-start gap-2 text-left w-full shadow-sm"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Invalid Credentials.</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Floating Footer info */}
      <footer className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[12px] font-semibold font-label text-outline tracking-wider uppercase select-none">
        Privacy &middot; Terms
      </footer>
    </main>
  );
}
