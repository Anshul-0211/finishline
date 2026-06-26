"use client";

export const dynamic = "force-dynamic";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type AuthMode = "google" | "login" | "signup";

export default function Home() {
  const { user, login, loginWithEmail, signUpWithEmail, logout, loading, error, setError } = useUserStore();
  const router = useRouter();
  
  const [authMode, setAuthMode] = useState<AuthMode>("google");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await login();
      router.push("/dashboard");
    } catch (err) {
      console.error("Google Login failed:", err);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      await loginWithEmail(email, password);
      router.push("/dashboard");
    } catch (err) {
      console.error("Email Login failed:", err);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      await signUpWithEmail(email, password, displayName);
      router.push("/dashboard");
    } catch (err) {
      console.error("Email Sign Up failed:", err);
    }
  };

  const switchMode = (mode: AuthMode) => {
    setError(null);
    setAuthMode(mode);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0D1117] text-[#1A202C] dark:text-[#E6EDF3] p-6 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-2xl shadow-xl p-8 space-y-6 flex flex-col items-center">
        
        {/* Header Title */}
        <div className="text-center space-y-2">
          <div className="h-16 w-16 bg-[#4A90D9]/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-[#4A90D9]/20">
            <span className="text-3xl">🏁</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">FinishLine</h1>
          <p className="text-xs text-[#4A5568] dark:text-[#8B949E] max-w-xs">
            Your AI Accountability Partner. Choose how to get started.
          </p>
        </div>

        {user ? (
          <div className="w-full space-y-4 text-center">
            <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl text-xs flex flex-col gap-1 items-center font-semibold">
              <span>You are signed in as:</span>
              <span className="text-white text-sm font-bold">{user.email}</span>
            </div>
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white font-bold py-3 px-5 rounded-xl transition duration-200 shadow-md hover:shadow-lg cursor-pointer text-sm"
              >
                Go to Dashboard
              </button>
              <button
                onClick={handleLogout}
                className="w-full border border-red-500/20 hover:bg-red-500/5 text-red-400 font-semibold py-2.5 px-5 rounded-xl transition duration-200 cursor-pointer text-xs"
              >
                Sign Out / Switch Account
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tab Selection */}
            <div className="w-full flex bg-[#F1F5F9] dark:bg-[#1C2128] p-1 rounded-xl border border-[#E2E8F0] dark:border-[#30363D]">
              <button
                onClick={() => switchMode("google")}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition duration-200 cursor-pointer ${
                  authMode === "google"
                    ? "bg-white dark:bg-[#161B22] text-[#4A90D9] shadow-sm"
                    : "text-[#4A5568] dark:text-[#8B949E] hover:text-[#1A202C] dark:hover:text-[#E6EDF3]"
                }`}
              >
                Google OAuth
              </button>
              <button
                onClick={() => switchMode("login")}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition duration-200 cursor-pointer ${
                  authMode === "login"
                    ? "bg-white dark:bg-[#161B22] text-[#4A90D9] shadow-sm"
                    : "text-[#4A5568] dark:text-[#8B949E] hover:text-[#1A202C] dark:hover:text-[#E6EDF3]"
                }`}
              >
                Email Login
              </button>
              <button
                onClick={() => switchMode("signup")}
                className={`flex-1 text-xs font-semibold py-2.5 rounded-lg transition duration-200 cursor-pointer ${
                  authMode === "signup"
                    ? "bg-white dark:bg-[#161B22] text-[#4A90D9] shadow-sm"
                    : "text-[#4A5568] dark:text-[#8B949E] hover:text-[#1A202C] dark:hover:text-[#E6EDF3]"
                }`}
              >
                Email Sign Up
              </button>
            </div>

            {/* Error Message banner */}
            {error && (
              <div className="w-full text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl p-3 text-left">
                <strong>Error:</strong> {error}
              </div>
            )}

            {/* Auth Forms */}
            <div className="w-full">
              {authMode === "google" && (
                <div className="space-y-4">
                  <button
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white font-medium py-3 px-5 rounded-xl transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Sign In with Google
                      </>
                    )}
                  </button>
                  <div className="text-[10px] text-[#4A5568] dark:text-[#8B949E] leading-relaxed text-center">
                    Requires standard Google scopes to synchronize commitments, calendars, and scan Gmail.
                  </div>
                </div>
              )}

              {authMode === "login" && (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#4A5568] dark:text-[#8B949E]">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#F8FAFC] dark:bg-[#1C2128] border border-[#E2E8F0] dark:border-[#30363D] px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-[#4A90D9] transition duration-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#4A5568] dark:text-[#8B949E]">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F8FAFC] dark:bg-[#1C2128] border border-[#E2E8F0] dark:border-[#30363D] px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-[#4A90D9] transition duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white font-medium py-3 px-5 rounded-xl transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      "Log In"
                    )}
                  </button>
                </form>
              )}

              {authMode === "signup" && (
                <form onSubmit={handleEmailSignUp} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#4A5568] dark:text-[#8B949E]">Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Judge Name"
                      className="w-full bg-[#F8FAFC] dark:bg-[#1C2128] border border-[#E2E8F0] dark:border-[#30363D] px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-[#4A90D9] transition duration-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#4A5568] dark:text-[#8B949E]">Email Address</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full bg-[#F8FAFC] dark:bg-[#1C2128] border border-[#E2E8F0] dark:border-[#30363D] px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-[#4A90D9] transition duration-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-[#4A5568] dark:text-[#8B949E]">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#F8FAFC] dark:bg-[#1C2128] border border-[#E2E8F0] dark:border-[#30363D] px-3.5 py-2 rounded-xl text-sm focus:outline-none focus:border-[#4A90D9] transition duration-200"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white font-medium py-3 px-5 rounded-xl transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                    ) : (
                      "Create Account"
                    )}
                  </button>
                </form>
              )}
            </div>
          </>
        )}

        {/* Footer Info */}
        <div className="text-[10px] text-[#4A5568] dark:text-[#8B949E] leading-relaxed text-center border-t border-[#E2E8F0] dark:border-[#30363D] pt-4 w-full">
          Standard Email registration lets you bypass Google authentication to view dashboard components and core planner tasks instantly.
        </div>
      </div>
    </div>
  );
}
