import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Award, Calendar, ChevronRight, Layers, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/debate/engine";
import { serializeSession } from "@/lib/debate/serializers";
import { prisma } from "@/lib/db/prisma";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

function statusTone(status: string): BadgeTone {
  if (status === "running") return "emerald";
  if (status === "awaiting_confirmation" || status === "paused") return "amber";
  if (status === "ended" || status === "stopped") return "rose";
  return "neutral";
}

function statusText(status: string) {
  const map: Record<string, string> = {
    draft: "已初始化",
    running: "开庭中",
    paused: "已暂停",
    awaiting_confirmation: "待核准",
    ended: "已结案",
    stopped: "已中止",
  };
  return map[status] ?? status;
}

function winnerText(winner: string | null) {
  if (!winner) return "未判定";
  if (winner === "A") return "甲方胜出";
  if (winner === "B") return "乙方胜出";
  if (winner === "Draw") return "判定平局";
  if (winner === "Stopped by user") return "手动终止";
  if (winner === "Round limit reached") return "达到轮数上限";
  return winner;
}

type HistoryPageProps = {
  searchParams: Promise<{
    q?: string | string[];
    status?: string | string[];
    date?: string | string[];
  }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  const params = await searchParams;
  const query = firstParam(params.q)?.trim() ?? "";
  const statusFilter = firstParam(params.status)?.trim() ?? "";
  const dateFilter = firstParam(params.date)?.trim() ?? "";
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const rawSessions = await prisma.debateSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: sessionInclude,
  });
  const sessions = rawSessions
    .map(serializeSession)
    .filter((session) => {
      const matchesQuery =
        !query ||
        session.topic.toLowerCase().includes(query.toLowerCase()) ||
        session.recapSummary?.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = !statusFilter || session.status === statusFilter;
      const matchesDate = !dateFilter || session.updatedAt.slice(0, 10) === dateFilter;
      return matchesQuery && matchesStatus && matchesDate;
    });
  const activeFilterCount = [query, statusFilter, dateFilter].filter(Boolean).length;
  const closedCount = sessions.filter((session) => session.status === "ended" || session.status === "stopped").length;
  const totalRounds = sessions.reduce((sum, session) => sum + session.rounds.length, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="border-b border-[var(--line)] pb-7">
          <div className="page-kicker">
            <Archive className="h-4 w-4 text-[var(--cinnabar)]" />
            本地卷宗
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">卷宗馆</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            支持按关键词、状态和日期筛选，结案卷宗可继续进入复盘和导出路径。
          </p>
        </header>

        <Panel className="p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-[var(--cinnabar)]" />
              <h2 className="font-serif text-lg font-bold text-[var(--ink)]">筛选卷宗</h2>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge tone="cyan">{sessions.length} 条结果</Badge>
              <Badge tone={activeFilterCount ? "amber" : "neutral"}>{activeFilterCount} 个条件</Badge>
            </div>
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_180px_auto]" action="/history">
            <label className="space-y-2">
              <span className="field-label">关键词</span>
              <input className="ink-input" defaultValue={query} name="q" placeholder="搜索议题或复盘摘要" />
            </label>
            <label className="space-y-2">
              <span className="field-label">状态</span>
              <select className="ink-select" defaultValue={statusFilter} name="status">
                <option value="">全部状态</option>
                <option value="draft">已初始化</option>
                <option value="running">开庭中</option>
                <option value="paused">已暂停</option>
                <option value="awaiting_confirmation">待核准</option>
                <option value="ended">已结案</option>
                <option value="stopped">已中止</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="field-label">日期</span>
              <input className="ink-input" defaultValue={dateFilter} name="date" type="date" />
            </label>
            <div className="flex items-end gap-2">
              <button className={buttonVariants({ variant: "primary", size: "md" })} type="submit">
                筛选
              </button>
              <a className={buttonVariants({ variant: "ghost", size: "md" })} href="/history">
                重置
              </a>
            </div>
          </form>
        </Panel>

        <section className="grid gap-3 md:grid-cols-3">
          {[
            ["匹配卷宗", sessions.length],
            ["结案卷宗", closedCount],
            ["回合总数", totalRounds],
          ].map(([label, value]) => (
            <div className="rounded-md border border-[var(--line)] bg-[var(--inline-surface)] p-4" key={label}>
              <div className="text-xs font-semibold text-[var(--muted)]">{label}</div>
              <div className="mt-2 font-serif text-3xl font-black text-[var(--ink)]">{value}</div>
            </div>
          ))}
        </section>

        {sessions.length === 0 ? (
          <Panel className="p-12 text-center">
            <Archive className="mx-auto h-10 w-10 text-[var(--muted-light)]" />
            <p className="mt-4 text-sm text-[var(--muted)]">没有匹配的庭审卷宗。</p>
            <Link className={buttonVariants({ variant: "primary", size: "md", className: "mt-5" })} href="/debate/setup">
              <Sparkles className="h-4 w-4" />
              新开一场
            </Link>
          </Panel>
        ) : (
          <div className="grid gap-3">
            {sessions.map((session) => (
              <Link href={`/debate/${session.id}`} key={session.id} className="block">
                <Panel className="group p-0 transition hover:border-[var(--cinnabar)] hover:bg-white/70">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="min-w-0">
                      <div className="p-5">
                        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                          <span className="inline-flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5" />
                            {session.rounds.length} 回合
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5" />
                            {formatDateTime(session.updatedAt)}
                          </span>
                          <span>卷宗 {session.id.slice(0, 8)}</span>
                        </div>
                        <h2 className="line-clamp-2 text-base font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--cinnabar)]">
                          {session.topic}
                        </h2>
                        <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                          {session.recapSummary ?? session.rounds.at(-1)?.judgeSummary ?? "暂无裁判复盘。"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-5 border-t border-[var(--line)] bg-[var(--inline-surface)] p-5 lg:border-l lg:border-t-0">
                      <div>
                        <div className="text-xs text-[var(--muted)]">优胜裁决</div>
                        <div className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
                          <Award className="h-4 w-4 text-[var(--brass)]" />
                          {winnerText(session.winner)}
                        </div>
                        <div className="mt-3">
                          <Badge tone={statusTone(session.status)}>{statusText(session.status)}</Badge>
                        </div>
                      </div>
                      <ChevronRight className="hidden h-5 w-5 text-[var(--muted-light)] transition group-hover:translate-x-0.5 group-hover:text-[var(--cinnabar)] sm:block" />
                    </div>
                  </div>
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
