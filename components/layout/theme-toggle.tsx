"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const storageKey = "lunheng-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const storedTheme = window.localStorage.getItem(storageKey);
      const nextTheme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
      setTheme(nextTheme);
      applyTheme(nextTheme);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "切换白天" : "切换暗夜";

  function toggleTheme() {
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    applyTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
  }

  return (
    <button
      aria-label={label}
      className={
        compact
          ? "flex h-11 w-11 items-center justify-center rounded-md border border-[var(--line)] bg-[var(--bg-glass)] text-[var(--muted)] transition hover:border-[var(--cinnabar)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
          : "inline-flex min-h-12 items-center justify-center gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-glass)] px-3 py-2 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--cinnabar)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }
      onClick={toggleTheme}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {compact ? null : <span>{isDark ? "白天" : "暗夜"}</span>}
    </button>
  );
}
