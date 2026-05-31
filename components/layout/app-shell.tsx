import Link from "next/link";
import { History, KeyRound, Landmark, LayoutDashboard, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const navItems = [
  { href: "/", label: "论衡", icon: Landmark },
  { href: "/dashboard", label: "总控", icon: LayoutDashboard },
  { href: "/debate/setup", label: "开辩", icon: Sparkles },
  { href: "/history", label: "档案", icon: History },
  { href: "/settings", label: "密钥", icon: KeyRound },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-canvas relative min-h-screen text-[var(--ink)]">
      <div className="paper-grain" />

      <aside className="content-frame fixed inset-y-0 left-0 z-40 hidden w-[76px] border-r border-[var(--line)] bg-[var(--sidebar-bg)] backdrop-blur-xl md:flex md:flex-col md:items-center">
        <Link
          aria-label="回到论衡剧场"
          className="mt-5 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--cinnabar)] bg-[var(--cinnabar)] font-serif text-lg font-black text-white shadow-[var(--glow-cinnabar)]"
          href="/"
        >
          衡
        </Link>

        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                aria-label={item.label}
                className="group relative flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                href={item.href}
                key={item.href}
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--bg-glass-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--ink)] opacity-0 shadow-lg transition group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mb-5 flex flex-col gap-2">
          <ThemeToggle compact />
          <div className="h-11 w-11 rounded-md border border-[var(--line)] bg-[var(--bg-glass)] text-center text-[10px] font-semibold leading-[42px] text-[var(--muted)]">
            v2
          </div>
        </div>
      </aside>

      <main className="content-frame mx-auto min-h-screen max-w-[1440px] px-4 pb-16 pt-4 sm:px-6 md:ml-[76px] md:px-9 md:py-8 lg:px-12">
        <nav className="mb-6 grid grid-cols-6 rounded-md border border-[var(--line)] bg-[var(--bg-glass)] p-1 shadow-[var(--shadow)] backdrop-blur-xl md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                className="flex min-h-12 flex-col items-center justify-center gap-1 rounded px-1 py-2 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle compact />
        </nav>
        {children}
      </main>
    </div>
  );
}
