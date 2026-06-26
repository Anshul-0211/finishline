"use client";

import { useAtom } from "jotai";
import { themeAtom } from "@/lib/atoms/themeAtom";
import { Sun, Moon, Monitor } from "lucide-react";

export default function ThemeToggle() {
  const [theme, setTheme] = useAtom(themeAtom);

  const cycleTheme = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-xl bg-[#21262D] border border-[#30363D] text-[#8B949E] hover:text-white hover:bg-[#30363D] transition flex items-center justify-center cursor-pointer"
      title={`Active theme: ${theme} (Click to change)`}
    >
      {theme === "light" && <Sun className="w-4 h-4" />}
      {theme === "dark" && <Moon className="w-4 h-4" />}
      {theme === "system" && <Monitor className="w-4 h-4" />}
    </button>
  );
}
