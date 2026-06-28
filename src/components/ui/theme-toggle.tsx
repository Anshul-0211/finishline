"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SPRING_FAST } from "@/lib/motion";
import { useEffect, useState } from "react";

const THEMES = ["light", "dark", "system"] as const;
type ThemeMode = (typeof THEMES)[number];

const ICONS = { light: Sun, dark: Moon, system: Monitor };
const NEXT_LABEL = {
  light: "Switch to dark mode",
  dark: "Switch to system mode",
  system: "Switch to light mode",
};

export function ThemeToggle({
  variant = "icon-only",
}: {
  variant?: "icon-only" | "labeled";
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => setMounted(true), []);
  
  if (!mounted) return <div className="w-9 h-9" />;

  const current = (theme ?? "system") as ThemeMode;
  const Icon = ICONS[current];

  const cycle = () => {
    const idx = THEMES.indexOf(current);
    setTheme(THEMES[(idx + 1) % THEMES.length]);
  };

  if (variant === "labeled") {
    return (
      <div className="flex gap-2">
        {THEMES.map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors
              ${
                theme === t
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
              }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={cycle}
      aria-label={NEXT_LABEL[current]}
      className="w-9 h-9 flex items-center justify-center rounded-full
                 hover:bg-surface-container-high transition-colors
                 focus-visible:ring-2 focus-visible:ring-primary
                 focus-visible:ring-offset-2
                 focus-visible:ring-offset-[var(--focus-offset-color)]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={current}
          initial={{ rotateY: 90, opacity: 0 }}
          animate={{ rotateY: 0, opacity: 1 }}
          exit={{ rotateY: -90, opacity: 0 }}
          transition={SPRING_FAST}
        >
          <Icon
            size={20}
            className={
              current === "light"
                ? "text-secondary"
                : current === "dark"
                ? "text-primary"
                : "text-on-surface-variant"
            }
          />
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
