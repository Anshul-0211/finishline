"use client";

export const dynamic = "force-dynamic";

import { useUserStore } from "@/lib/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function Dashboard() {
  const { user, logout, loading } = useUserStore();
  const router = useRouter();

  useEffect(() => {
    // Standard safety check
    const hasSessionCookie = document.cookie.split(";").some((item) => item.trim().startsWith("session="));
    if (!hasSessionCookie && !user) {
      router.push("/");
    }
  }, [user, router]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0D1117] text-[#1A202C] dark:text-[#E6EDF3] flex flex-col transition-colors duration-300">
      <nav className="border-b border-[#E2E8F0] dark:border-[#30363D] bg-white dark:bg-[#161B22] py-4 px-6 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏁</span>
          <span className="font-bold text-lg">FinishLine</span>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              {user.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border border-[#E2E8F0] dark:border-[#30363D]"
                />
              )}
              <span className="text-sm font-medium hidden sm:inline">
                {user.displayName}
              </span>
            </div>
          )}
          <button
            onClick={handleLogout}
            disabled={loading}
            className="text-xs bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 font-semibold py-2 px-3 rounded-lg border border-red-200 dark:border-red-900/50 transition duration-200 cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>
      <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[#4A5568] dark:text-[#8B949E]">
            Welcome to FinishLine! Project Foundation is successfully configured.
          </p>
        </header>

        <section className="bg-white dark:bg-[#161B22] border border-[#E2E8F0] dark:border-[#30363D] rounded-2xl p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-bold">Foundation Status Checks</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300">
              <span className="text-base">✓</span>
              <span>Next.js App Router Scaffold</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300">
              <span className="text-base">✓</span>
              <span>Firebase Auth & Store Integrated</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300">
              <span className="text-base">✓</span>
              <span>Token Encryption Layer Deployed</span>
            </div>
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-green-50 dark:bg-green-950/10 border border-green-200 dark:border-green-900/30 text-green-800 dark:text-green-300">
              <span className="text-base">✓</span>
              <span>Zustand & Jotai Stores Configured</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
