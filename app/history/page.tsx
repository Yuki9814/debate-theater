import Link from "next/link";
import { Archive, Award, Calendar, ChevronRight, Layers } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { ensureDemoUser, sessionInclude } from "@/lib/debate/engine";
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
    running: "演算中",
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

export default async function HistoryPage() {
  const user = await ensureDemoUser();
  const sessions = await prisma.debateSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    include: sessionInclude,
  });

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="border-b border-[var(--line)] pb-7">
          <div className="page-kicker">
            <Archive className="h-4 w-4 text-[var(--cinnabar)]" />
            Local Archive
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">档案馆</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            所有辩局记录均来自本地 SQLite。
          </p>
        </header>

        {sessions.length === 0 ? (
          <Panel className="p-12 text-center">
            <Archive className="mx-auto h-10 w-10 text-[var(--muted-light)]" />
            <p className="mt-4 text-sm text-[var(--muted)]">暂无已沉淀的辩局档案。</p>
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
