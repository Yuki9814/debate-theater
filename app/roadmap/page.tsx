import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { WaitlistForm } from "@/components/product/waitlist-form";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { roadmapModules } from "@/lib/product/conversion";

export const dynamic = "force-dynamic";

type RoadmapPageProps = {
  searchParams: Promise<{ module?: string | string[] }>;
};

export default async function RoadmapPage({ searchParams }: RoadmapPageProps) {
  const params = await searchParams;
  const selectedId = Array.isArray(params.module) ? params.module[0] : params.module;
  const selected = roadmapModules.find((module) => module.id === selectedId) ?? roadmapModules[0];
  const SelectedIcon = selected.icon;

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="border-b border-[var(--line)] pb-7">
          <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            返回总控台
          </Link>
          <div className="page-kicker mt-6">
            <Sparkles className="h-4 w-4 text-[var(--cinnabar)]" />
            公测路线图
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">等待名单与模块计划</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            未来模块先收集真实意向，不把未完成能力伪装成可用入口。
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <Panel className="p-5 sm:p-6">
            <Badge tone="cyan">选择模块</Badge>
            <div className="mt-5 divide-y divide-[var(--line)]">
              {roadmapModules.map((module) => {
                const Icon = module.icon;
                const active = module.id === selected.id;
                return (
                  <Link
                    className={
                      active
                        ? "flex gap-3 py-4 text-[var(--cinnabar)]"
                        : "flex gap-3 py-4 text-[var(--ink-soft)] transition hover:text-[var(--cinnabar)]"
                    }
                    href={`/roadmap?module=${module.id}`}
                    key={module.id}
                  >
                    <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold">{module.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-[var(--muted)]">{module.summary}</span>
                    </span>
                    {active ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : null}
                  </Link>
                );
              })}
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel className="docket-paper p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <Badge tone="amber">{selected.status}</Badge>
                  <h2 className="mt-4 font-serif text-3xl font-black text-[var(--ink)]">{selected.title}</h2>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-md border border-[var(--line)] bg-white/50 text-[var(--cinnabar)]">
                  <SelectedIcon className="h-6 w-6" />
                </div>
              </div>
              <p className="mt-5 text-sm leading-8 text-[var(--ink-soft)]">{selected.summary}</p>
              <div className="mt-5 rounded-md border border-[var(--line)] bg-white/42 p-4 text-sm leading-7 text-[var(--muted)]">
                {selected.unlock}
              </div>
            </Panel>

            <Panel className="p-5 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
                <div>
                  <Badge tone="rose">意向收集</Badge>
                  <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">留下一个真实用例</h2>
                </div>
                <Link className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--muted)] hover:text-[var(--cinnabar)]" href="/debate/setup">
                  先用自由辩论场
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              <WaitlistForm moduleId={selected.id} />
            </Panel>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
