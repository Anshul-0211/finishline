"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Mail,
  Calendar,
  BookOpen,
  Settings,
  LogOut,
  User as UserIcon,
} from "lucide-react";

import ThemeToggle from "@/components/ui/ThemeToggle";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useUserStore();
  const [agentStatus, setAgentStatus] = useState<{
    lastRunAt: string | null;
    status: "active" | "warning" | "error";
  }>({ lastRunAt: null, status: "warning" });

  const fetchAgentStatus = async () => {
    if (!user?.uid) return;
    try {
      const res = await fetch(`/api/agent/status/${user.uid}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.lastRunAt) {
          const lastRun = new Date(data.lastRunAt).getTime();
          const diffMinutes = (Date.now() - lastRun) / (60 * 1000);
          
          let status: "active" | "warning" | "error" = "active";
          if (diffMinutes > 65) status = "error";
          else if (diffMinutes > 35) status = "warning";
          
          setAgentStatus({ lastRunAt: data.lastRunAt, status });
        }
      }
    } catch (err) {
      console.error("Failed to fetch agent status:", err);
    }
  };

  useEffect(() => {
    fetchAgentStatus();
    const interval = setInterval(fetchAgentStatus, 5 * 60 * 1000); // Poll every 5 minutes
    return () => clearInterval(interval);
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/commitments", label: "Commitments", icon: CheckSquare },
    { href: "/dashboard/add", label: "Add New", icon: PlusCircle, isCta: true },
    { href: "/dashboard/gmail", label: "Gmail Scan", icon: Mail },
    { href: "/dashboard/weekly-planning", label: "Weekly Planning", icon: Calendar },
    { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
    { href: "/dashboard/reflection", label: "Reflection", icon: BookOpen },
  ];

  return (
    <aside className="w-64 bg-card border-r border-border flex flex-col h-screen text-foreground select-none sticky top-0">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#30363D] flex items-center gap-2">
        <span className="text-2xl">🏁</span>
        <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
          FinishLine
        </span>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {navLinks.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href;
          
          if (link.isCta) {
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold shadow-md transition duration-200"
              >
                <Icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 w-full py-2.5 px-4 rounded-xl text-sm font-medium transition duration-150 ${
                isActive
                  ? "bg-[#21262D] text-blue-400 border border-[#30363D]"
                  : "text-[#8B949E] hover:bg-[#21262D] hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User and Status Footer */}
      <div className="p-4 border-t border-[#30363D] space-y-4">
        {/* User Card */}
        {user && (
          <div className="flex items-center gap-3 bg-background p-3 rounded-xl border border-border">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center border border-blue-500/20">
                <UserIcon className="w-5 h-5 text-blue-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{user.displayName}</p>
              <p className="text-xs text-[#8B949E] truncate">{user.email}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="text-[#8B949E] hover:text-red-400 p-1.5 rounded-lg hover:bg-[#21262D] transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Agent Status Bar */}
        <div className="flex items-center justify-between text-xs text-[#8B949E] px-2">
          <span>Agent heartbeat</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                agentStatus.status === "active"
                  ? "bg-green-500 animate-pulse"
                  : agentStatus.status === "warning"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="font-medium uppercase tracking-wider text-[10px]">
              {agentStatus.status === "active"
                ? "Active"
                : agentStatus.status === "warning"
                ? "Stale"
                : "Offline"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
