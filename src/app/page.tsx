"use client";

export const dynamic = "force-dynamic";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Home() {
  const { user, login, loading, error } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async () => {
    try {
      await login();
      router.push("/dashboard");
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] dark:bg-[#0D1117] text-[#1A202C] dark:text-[#E6EDF3] p-6 transition-colors duration-300">
      <div className="max-w-md w-full bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-2xl shadow-xl p-8 space-y-8 flex flex-col items-center text-center">
        <div className="space-y-3">
          <div className="h-16 w-16 bg-[#4A90D9]/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-[#4A90D9]/20">
            <span className="text-3xl">🏁</span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">FinishLine</h1>
          <p className="text-sm text-[#4A5568] dark:text-[#8B949E] max-w-xs">
            Your AI-Powered Accountability Partner. Complete what you start.
          </p>
        </div>

        {error && (
          <div className="w-full text-xs text-red-500 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 text-left">
            <strong>Error:</strong> {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#4A90D9] hover:bg-[#4A90D9]/90 text-white font-medium py-3.5 px-5 rounded-xl transition duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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

        <div className="text-[11px] text-[#4A5568] dark:text-[#8B949E] leading-relaxed">
          Google Calendar + Readonly Gmail permissions will be requested to synchronize your schedules and detect commitments.
        </div>
      </div>
    </div>
  );
}
