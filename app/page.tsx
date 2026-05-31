import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  History,
  Landmark,
  Scale,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { getBillingEntitlement } from "@/lib/billing/service";
import { ensureDemoUser } from "@/lib/debate/engine";
import { prisma } from "@/lib/db/prisma";
import { conversionScenarios, paidUseCases, trustChecklist } from "@/lib/product/conversion";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const quickPrompts = [
  "AI 产品是否应该默认开启自动执行任务能力？",
  "小说主角为多数人牺牲少数人是否正当？",
  "城市治理是否应允许算法裁量参与行政判断？",
];

const verdictSnapshot = {
  round: "第 10 轮",
  summary: "乙方凭借更清晰的因果结构与更准确的反驳目标占优。",
  scores: ["甲 78", "乙 87"],
};

function planTone(remainingRounds: number) {
  if (remainingRounds <= 0) return "rose" as const;
  if (remainingRounds <= 20) return "amber" as const;
  return "emerald" as const;
}

export default async function Home() {
  const user = await ensureDemoUser();
  const [recentSessions, entitlement] = await Promise.all([
    prisma.debateSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 4,
    }),
    getBillingEntitlement(user.id),
  ]);
  const exampleHref = recentSessions[0] ? `/debate/${recentSessions[0].id}` : "/history";

  return (
    <AppShell>
      <div className="space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.04fr_0.96fr] lg:items-end">
          <div className="space-y-7 py-4">
            <div className="page-kicker">
              <Landmark className="h-4 w-4 text-[var(--cinnabar)]" />
              公测自由辩论场
            </div>

            <div className="max-w-4xl space-y-5">
              <h1 className="page-title">论衡剧场</h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                让两个 AI 围绕同一议题攻防，并由裁判给出可复盘评分。三分钟开一场 mock 辩论，结案后沉淀成卷宗。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className={buttonVariants({ variant: "primary", size: "lg" })} href="/debate/setup">
                <Sparkles className="h-4 w-4" />
                开一场辩论
              </Link>
              <Link className={buttonVariants({ variant: "secondary", size: "lg" })} href={exampleHref}>
                <History className="h-4 w-4" />
                查看示例卷宗
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["30 秒", "看懂议题、席次与评分"],
                ["3 分钟", "跑完第一场 mock 辩论"],
                ["结案后", "复盘、导出、继续追问"],
              ].map(([value, label]) => (
                <div className="rounded-md border border-[var(--line)] bg-[var(--inline-surface)] p-3" key={value}>
                  <div className="font-serif text-2xl font-black text-[var(--ink)]">{value}</div>
                  <div className="mt-1 text-xs leading-5 text-[var(--muted)]">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <Panel className="docket-paper p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <Badge tone="rose">今日可开题</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">从一个问题开始</h2>
              </div>
              <Scale className="h-6 w-6 text-[var(--cinnabar)]" />
            </div>

            <div className="mt-5 space-y-3">
              {quickPrompts.map((prompt, index) => (
                <Link
                  className="group flex items-start justify-between gap-4 rounded-md border border-[var(--line)] bg-white/50 p-4 transition hover:border-[var(--cinnabar)] hover:bg-white/80"
                  href={`/debate/setup?topic=${encodeURIComponent(prompt)}`}
                  key={prompt}
                >
                  <span className="text-sm leading-6 text-[var(--ink-soft)]">
                    <span className="mr-2 font-serif text-lg font-bold text-[var(--cinnabar)]">
                      {index + 1}
                    </span>
                    {prompt}
                  </span>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[var(--muted-light)] transition group-hover:translate-x-0.5 group-hover:text-[var(--cinnabar)]" />
                </Link>
              ))}
            </div>

            <div className="mt-5 rounded-md border border-[var(--line)] bg-white/42 p-4">
              <div className="flex items-center justify-between gap-3">
                <Badge tone="amber">裁判快照</Badge>
                <span className="text-xs font-semibold text-[var(--muted)]">{verdictSnapshot.round}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{verdictSnapshot.summary}</p>
              <div className="mt-4 flex gap-2">
                {verdictSnapshot.scores.map((score, index) => (
                  <span
                    className={
                      index === 0
                        ? "rounded-full bg-[var(--cinnabar-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--cinnabar)]"
                        : "rounded-full bg-[var(--lapis-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--lapis)]"
                    }
                    key={score}
                  >
                    {score}
                  </span>
                ))}
              </div>
            </div>
          </Panel>
        </section>

        <section className="section-rule pt-7">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <Badge tone="cyan">高频场景</Badge>
              <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">不是聊天，是论证预演</h2>
            </div>
            <Badge tone={planTone(entitlement.remainingRounds)}>
              剩余额度 {entitlement.remainingRounds}/{entitlement.plan.monthlyRoundLimit} 轮
            </Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {conversionScenarios.map((scenario) => {
              const Icon = scenario.icon;
              return (
                <Panel className="p-5" key={scenario.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white/55 text-[var(--lapis)]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge tone="neutral">可立即开辩</Badge>
                  </div>
                  <h3 className="mt-4 font-serif text-xl font-bold text-[var(--ink)]">{scenario.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{scenario.body}</p>
                  <Link
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[var(--cinnabar)] transition hover:text-[var(--ink)]"
                    href={`/debate/setup?scenario=${scenario.id}`}
                  >
                    {scenario.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Panel>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.26fr_0.74fr]">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <Badge tone="cyan">最近卷宗</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">复盘入口</h2>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/history">
                全部卷宗
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentSessions.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--line-strong)] p-10 text-center text-sm text-[var(--muted)]">
                暂无立卷记录。先开一场 mock 辩论，结案后这里会出现复盘入口。
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {recentSessions.map((session) => (
                  <Link
                    className="group grid grid-cols-[1fr_auto] gap-3 py-4 transition hover:bg-white/35"
                    href={`/debate/${session.id}`}
                    key={session.id}
                  >
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-[var(--ink)] group-hover:text-[var(--cinnabar)]">
                        {session.topic}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                        <span>第 {session.currentRound}/{session.maxRounds} 轮</span>
                        <span className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
                        <span>{formatDate(session.updatedAt)}</span>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 self-center text-[var(--muted-light)] transition group-hover:translate-x-0.5 group-hover:text-[var(--cinnabar)]" />
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          <div className="space-y-6">
            <Panel className="p-5 sm:p-6">
              <Badge tone="amber">公测信任</Badge>
              <div className="mt-5 space-y-3">
                {trustChecklist.map((item) => (
                  <div className="flex items-start gap-3 text-sm leading-6 text-[var(--muted)]" key={item}>
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--jade)]" />
                    {item}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel className="p-5 sm:p-6">
              <Badge tone="rose">升级会解决什么</Badge>
              <div className="mt-5 space-y-4">
                {paidUseCases.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div className="flex gap-3 border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0" key={item.title}>
                      <Icon className="mt-1 h-4 w-4 shrink-0 text-[var(--cinnabar)]" />
                      <div>
                        <h3 className="text-sm font-bold text-[var(--ink)]">{item.title}</h3>
                        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
          <BookOpen className="h-3.5 w-3.5" />
          本地卷宗随数据库实时刷新
          <Clock className="h-3.5 w-3.5" />
          公测默认使用 mock 模式
          <ShieldCheck className="h-3.5 w-3.5" />
          <Link className="font-semibold hover:text-[var(--cinnabar)]" href="/legal/privacy">
            隐私
          </Link>
          <Link className="font-semibold hover:text-[var(--cinnabar)]" href="/legal/terms">
            条款
          </Link>
          <Link className="font-semibold hover:text-[var(--cinnabar)]" href="/legal/data">
            导出与删除
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
