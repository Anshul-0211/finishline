"use client";

import Sidebar from "@/components/navigation/Sidebar";
import BottomTabBar from "@/components/navigation/BottomTabBar";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = useUserStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Client-side authentication check
    const hasSessionCookie = document.cookie
      .split(";")
      .some((item) => item.trim().startsWith("session="));
    if (!hasSessionCookie && !user) {
      router.push("/");
    }
  }, [user, router]);

  if (!mounted) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#0D1117] text-[#E6EDF3] overflow-hidden">
      {/* Sidebar: visible on Desktop */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Tab Bar: visible on Mobile & Tablet */}
      <div className="block lg:hidden">
        <BottomTabBar />
      </div>
    </div>
  );
}
