import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, Award, Calendar, ChevronRight, Layers } from "lucide-react";
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

        {sessions.length === 0 ? (
          <Panel className="p-12 text-center">
            <Archive className="mx-auto h-10 w-10 text-[var(--muted-light)]" />
            <p className="mt-4 text-sm text-[var(--muted)]">没有匹配的庭审卷宗。</p>
          </Panel>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <Link href={`/debate/${session.id}`} key={session.id} className="block">
                <Panel className="group p-5 transition hover:border-[var(--cinnabar)] hover:bg-white/70">
                  <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        <span className="inline-flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5" />
                          {session.rounds.length} 回合
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDateTime(session.updatedAt)}
                        </span>
                      </div>
                      <h2 className="line-clamp-2 text-base font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--cinnabar)]">
                        {session.topic}
                      </h2>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--muted)]">
                        {session.recapSummary ?? session.rounds.at(-1)?.judgeSummary ?? "暂无裁判复盘。"}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-5 border-t border-[var(--line)] pt-4 lg:border-t-0 lg:pt-0">
                      <div className="text-right">
                        <div className="text-xs text-[var(--muted)]">优胜裁决</div>
                        <div className="mt-1 flex items-center justify-end gap-1.5 text-sm font-semibold text-[var(--ink)]">
                          <Award className="h-4 w-4 text-[var(--brass)]" />
                          {winnerText(session.winner)}
                        </div>
                      </div>
                      <Badge tone={statusTone(session.status)}>{statusText(session.status)}</Badge>
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
