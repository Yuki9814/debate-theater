import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Landmark, PauseCircle, Sparkles, Terminal, Zap } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { BillingPanel } from "@/components/billing/billing-panel";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getCurrentUser } from "@/lib/auth/session";
import { getBillingEntitlement } from "@/lib/billing/service";
import { sessionInclude } from "@/lib/debate/engine";
import { prisma } from "@/lib/db/prisma";
import { conversionScenarios, roadmapModules } from "@/lib/product/conversion";
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

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const [sessions, entitlement] = await Promise.all([
    prisma.debateSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: sessionInclude,
    }),
    getBillingEntitlement(user.id),
  ]);

  const runningCount = sessions.filter((session) => session.status === "running").length;
  const closedCount = sessions.filter((session) => session.status === "ended" || session.status === "stopped").length;
  const totalRounds = sessions.reduce((sum, session) => sum + session.rounds.length, 0);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="page-kicker">
              <Terminal className="h-4 w-4 text-[var(--cinnabar)]" />
              卷宗总台
            </div>
            <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">法庭总控台</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              从高频场景开辩、查看进行中的卷宗，并掌握本月剩余额度。
            </p>
          </div>
          <Link className={buttonVariants({ variant: "primary", size: "lg" })} href="/debate/setup">
            <Sparkles className="h-4 w-4" />
            递交战书
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            { label: "开庭中", value: runningCount, icon: Clock, tone: "emerald" as const },
            { label: "已结案", value: closedCount, icon: CheckCircle2, tone: "rose" as const },
            { label: "累计回合", value: totalRounds, icon: PauseCircle, tone: "cyan" as const },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Panel className="p-5" key={item.label}>
                <div className="flex items-center justify-between">
                  <Badge tone={item.tone}>{item.label}</Badge>
                  <Icon className="h-5 w-5 text-[var(--muted-light)]" />
                </div>
                <div className="mt-5 font-serif text-4xl font-black text-[var(--ink)]">{item.value}</div>
              </Panel>
            );
          })}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
              <div>
                <Badge tone="cyan">快速入口</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">按任务开一场</h2>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/debate/setup">
                自定义议题
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {conversionScenarios.map((scenario) => {
                const Icon = scenario.icon;
                return (
                  <Link
                    className="rounded-md border border-[var(--line)] bg-white/35 p-4 transition hover:border-[var(--cinnabar)] hover:bg-white/65"
                    href={`/debate/setup?scenario=${scenario.id}`}
                    key={scenario.id}
                  >
                    <Icon className="h-5 w-5 text-[var(--cinnabar)]" />
                    <h3 className="mt-3 text-sm font-bold text-[var(--ink)]">{scenario.title}</h3>
                    <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{scenario.body}</p>
                  </Link>
                );
              })}
            </div>
          </Panel>

          <Panel className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5 text-[var(--cinnabar)]" />
              <h2 className="font-serif text-xl font-bold text-[var(--ink)]">本月额度</h2>
            </div>
            <div className="mt-5 font-serif text-4xl font-black text-[var(--ink)]">
              {entitlement.remainingRounds}
              <span className="ml-2 text-sm font-semibold text-[var(--muted)]">/ {entitlement.plan.monthlyRoundLimit} 轮</span>
            </div>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{entitlement.upgradeRecommendation.message}</p>
            <Link className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-5" })} href="/dashboard#billing">
              查看升级方案
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.38fr_0.62fr]">
          <Panel className="p-0">
            <div className="flex items-center justify-between border-b border-[var(--line)] p-5 sm:p-6">
              <div>
                <Badge tone="cyan">卷宗线</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">庭审演进</h2>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/history">
                档案馆
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="p-5 sm:p-6">
              {sessions.length === 0 ? (
                <div className="rounded-md border border-dashed border-[var(--line-strong)] p-12 text-center text-sm text-[var(--muted)]">
                  还没有立卷记录。
                </div>
              ) : (
                <div className="relative space-y-0 before:absolute before:left-3 before:top-3 before:h-[calc(100%-1.5rem)] before:w-px before:bg-[var(--line)]">
                  {sessions.map((session) => (
                    <Link
                      className="group relative block py-4 pl-10"
                      href={`/debate/${session.id}`}
                      key={session.id}
                    >
                      <span className="absolute left-[7px] top-6 h-3 w-3 rounded-full border border-[var(--cinnabar)] bg-[var(--paper)]" />
                      <div className="rounded-md border border-transparent p-3 transition group-hover:border-[var(--line)] group-hover:bg-white/45">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <h3 className="line-clamp-2 text-base font-semibold leading-6 text-[var(--ink)] group-hover:text-[var(--cinnabar)]">
                              {session.topic}
                            </h3>
                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
                              <span>卷宗 {session.id.slice(0, 8)}</span>
                              <span>{formatDateTime(session.updatedAt)}</span>
                              <span>第 {session.currentRound}/{session.maxRounds} 轮</span>
                            </div>
                          </div>
                          <Badge tone={statusTone(session.status)}>{statusText(session.status)}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel className="p-5 sm:p-6">
              <Badge tone="amber">模块</Badge>
              <div className="mt-5 divide-y divide-[var(--line)]">
                {roadmapModules.map((item) => (
                  <Link
                    className="flex items-center justify-between gap-3 py-4 text-sm transition hover:text-[var(--cinnabar)]"
                    href={`/roadmap?module=${item.id}`}
                    key={item.id}
                  >
                    <span className="font-semibold text-[var(--ink)]">{item.title}</span>
                    <span className="text-xs text-[var(--muted)]">{item.status}</span>
                  </Link>
                ))}
              </div>
            </Panel>

            <Panel className="p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <Landmark className="h-5 w-5 text-[var(--lapis)]" />
                <h2 className="font-serif text-xl font-bold text-[var(--ink)]">安全规约</h2>
              </div>
              <div className="mt-5 space-y-4 text-sm leading-7 text-[var(--muted)]">
                <p>连续低分、轮数上限与人工断点共同约束庭审进程。</p>
                <p>真实接口密钥只在服务端加密存储。</p>
              </div>
            </Panel>
          </div>
        </section>

        <div id="billing">
          <BillingPanel />
        </div>
      </div>
    </AppShell>
  );
}
