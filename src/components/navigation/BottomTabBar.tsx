"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Calendar,
  User as UserIcon,
} from "lucide-react";

export default function BottomTabBar() {
  const pathname = usePathname();

  const tabs = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/dashboard/commitments", label: "Commitments", icon: CheckSquare },
    { href: "/dashboard/add", label: "Add", icon: PlusCircle, isCta: true },
    { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
    { href: "/dashboard/profile", label: "Profile", icon: UserIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card border-t border-border flex items-center justify-around px-4 z-40 select-none">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = pathname === tab.href;

        if (tab.isCta) {
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex items-center justify-center -translate-y-4 w-12 h-12 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg border-4 border-background transition transform duration-200 active:scale-95"
            >
              <Icon className="w-6 h-6" />
            </Link>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center w-14 h-full transition duration-150 ${
              isActive ? "text-blue-400" : "text-[#8B949E]"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
