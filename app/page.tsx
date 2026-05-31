import Link from "next/link";
import { ArrowRight, Clock, History, Landmark, Scale, ShieldCheck, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { ensureDemoUser } from "@/lib/debate/engine";
import { prisma } from "@/lib/db/prisma";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const prompts = [
  "人工智能是否应获得有限法律主体资格？",
  "大模型生成物是否应被纳入公共档案保存？",
  "城市治理是否应允许算法裁量参与行政判断？",
];

const operatingNotes = [
  { label: "辩手", value: "甲 / 乙", icon: Sparkles },
  { label: "裁判", value: "逐轮评分", icon: Scale },
  { label: "密钥", value: "服务端密存", icon: ShieldCheck },
];

export default async function Home() {
  const user = await ensureDemoUser();
  const recentSessions = await prisma.debateSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 4,
  });

  return (
    <AppShell>
      <div className="space-y-12">
        <section className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
          <div className="space-y-7 py-4">
            <div className="page-kicker">
              <Landmark className="h-4 w-4 text-[var(--cinnabar)]" />
              Debate Theater
            </div>

            <div className="max-w-4xl space-y-5">
              <h1 className="page-title">论衡剧场</h1>
              <p className="max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
                把一场中文 AI 辩论整理成可控、可审、可复盘的评议流程。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className={buttonVariants({ variant: "primary", size: "lg" })} href="/debate/setup">
                <Sparkles className="h-4 w-4" />
                开启新辩局
              </Link>
              <Link className={buttonVariants({ variant: "secondary", size: "lg" })} href="/history">
                <History className="h-4 w-4" />
                查看档案
              </Link>
            </div>
          </div>

          <Panel className="p-5 sm:p-6">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
              <div>
                <Badge tone="rose">今日议席</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">候选辩题</h2>
              </div>
              <Scale className="h-6 w-6 text-[var(--cinnabar)]" />
            </div>

            <div className="mt-5 space-y-3">
              {prompts.map((prompt, index) => (
                <Link
                  className="group flex items-start justify-between gap-4 rounded-md border border-[var(--line)] bg-white/45 p-4 transition hover:border-[var(--cinnabar)] hover:bg-white/75"
                  href="/debate/setup"
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
          </Panel>
        </section>

        <section className="section-rule grid gap-5 pt-7 md:grid-cols-3">
          {operatingNotes.map((item) => {
            const Icon = item.icon;
            return (
              <div className="flex items-center gap-4" key={item.label}>
                <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--line)] bg-white/55 text-[var(--lapis)]">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[var(--muted)]">{item.label}</div>
                  <div className="mt-1 font-serif text-lg font-bold text-[var(--ink)]">{item.value}</div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <Badge tone="cyan">最近档案</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">研判记录</h2>
              </div>
              <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/history">
                全部
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            {recentSessions.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--line-strong)] p-10 text-center text-sm text-[var(--muted)]">
                暂无辩局档案。
              </div>
            ) : (
              <div className="divide-y divide-[var(--line)]">
                {recentSessions.map((session) => (
                  <Link
                    className="group grid gap-3 py-4 transition hover:bg-white/35 sm:grid-cols-[1fr_auto]"
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

          <Panel className="p-5 sm:p-6">
            <Badge tone="amber">评议规约</Badge>
            <div className="mt-5 space-y-5">
              {[
                ["断点", "每隔设定轮数暂停核准"],
                ["低分线", "连续低分触发保护裁决"],
                ["密钥", "只在服务端存取与调用"],
              ].map(([title, text]) => (
                <div className="border-b border-[var(--line)] pb-4 last:border-b-0 last:pb-0" key={title}>
                  <h3 className="font-serif text-lg font-bold text-[var(--ink)]">{title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{text}</p>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <Clock className="h-3.5 w-3.5" />
          本地工作台状态随数据库实时刷新
        </div>
      </div>
    </AppShell>
  );
}
