"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Plus, Calendar, CalendarRange, Settings, LogOut, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useUserStore } from "@/lib/stores/useUserStore";

export interface NavShellProps {
  children: React.ReactNode;
  displayName?: string;
  avatarUrl?: string;
  hideBottomNav?: boolean;
}

export const NavShell: React.FC<NavShellProps> = ({
  children,
  displayName = "Guest User",
  avatarUrl,
  hideBottomNav = false,
}) => {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useUserStore();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Signout error:", err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const tabs = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Add", href: "/add", icon: Plus },
    { name: "Calendar", href: "/calendar", icon: Calendar },
    { name: "Planning", href: "/planning", icon: CalendarRange },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-200">
      {/* Top Navigation */}
      <nav className="bg-surface-container-lowest border-b border-outline-variant sticky top-0 z-40 px-4 py-3 flex justify-between items-center transition-colors duration-200 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏁</span>
          <span className="font-sans font-semibold text-[16px] text-on-surface tracking-tight">
            FinishLine
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle variant="icon-only" />
          
          <div className="flex items-center gap-2 border-l border-outline-variant pl-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-8 h-8 rounded-full border border-outline-variant flex-shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-sans font-bold text-xs flex-shrink-0 border border-outline-variant">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[16px] font-medium text-on-surface hidden sm:inline max-w-[120px] truncate leading-none">
              {displayName}
            </span>

            {/* Sign Out Trigger */}
            <button
              onClick={handleSignOut}
              disabled={isLoggingOut}
              className="ml-1.5 p-1.5 rounded-md text-outline hover:text-error hover:bg-error/10 transition-colors duration-200 outline-none focus-visible:ring-2 focus-visible:ring-error"
              title="Sign Out"
              aria-label="Sign Out"
            >
              {isLoggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin text-outline" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className={`flex-grow w-full flex flex-col min-h-0 ${hideBottomNav ? "" : "pb-20"}`}>
        {children}
      </main>

      {/* Bottom Navigation Tab Bar */}
      {!hideBottomNav && (
        <div className="fixed bottom-0 left-0 right-0 bg-surface-container-lowest border-t border-outline-variant z-40 pb-[env(safe-area-inset-bottom)] transition-colors duration-200 shadow-[0_-2px_10px_rgba(0,0,0,0.03)]">
          <div className="max-w-md mx-auto flex justify-around items-center h-16">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors duration-200 outline-none focus-visible:bg-surface-container-low ${
                    isActive
                      ? "text-primary"
                      : "text-outline hover:text-on-surface-variant"
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="font-label text-[12px] font-semibold tracking-wide">
                    {tab.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavShell;
