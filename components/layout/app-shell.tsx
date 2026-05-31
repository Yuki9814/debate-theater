import Link from "next/link";
import { History, KeyRound, Landmark, LayoutDashboard, Sparkles } from "lucide-react";

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

      <aside className="content-frame fixed inset-y-0 left-0 z-40 hidden w-[76px] border-r border-[var(--line)] bg-[rgba(247,246,240,0.88)] backdrop-blur-xl md:flex md:flex-col md:items-center">
        <Link
          aria-label="回到论衡剧场"
          className="mt-5 flex h-11 w-11 items-center justify-center rounded-md border border-[var(--ink)] bg-[var(--ink)] font-serif text-lg font-black text-[var(--paper-warm)]"
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
                className="group relative flex h-11 w-11 items-center justify-center rounded-md text-[var(--muted)] transition hover:bg-white/70 hover:text-[var(--ink)]"
                href={item.href}
                key={item.href}
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-[54px] top-1/2 -translate-y-1/2 rounded-md border border-[var(--line)] bg-[var(--ink)] px-2.5 py-1 text-xs font-semibold text-[var(--paper-warm)] opacity-0 shadow-lg transition group-hover:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mb-5 h-11 w-11 rounded-md border border-[var(--line)] bg-white/45 text-center text-[10px] font-semibold leading-[42px] text-[var(--muted)]">
          v2
        </div>
      </aside>

      <main className="content-frame mx-auto min-h-screen max-w-[1440px] px-4 pb-24 pt-5 sm:px-6 md:ml-[76px] md:px-9 md:py-8 lg:px-12">
        {children}
      </main>

      <nav className="content-frame fixed inset-x-3 bottom-3 z-50 grid grid-cols-5 rounded-md border border-[var(--line)] bg-[rgba(247,246,240,0.92)] p-1 shadow-[var(--shadow)] backdrop-blur-xl md:hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              className="flex flex-col items-center justify-center gap-1 rounded px-1 py-2 text-[10px] font-semibold text-[var(--muted)] transition hover:bg-white/70 hover:text-[var(--ink)]"
              href={item.href}
              key={item.href}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
