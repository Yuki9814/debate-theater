"use client";

import { useState, useTransition } from "react";
import { GitBranch, RotateCcw, Route, Square, StepForward } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { CompanionSessionDTO } from "@/lib/companion/engine";
import { secureFetch } from "@/lib/security/secure-fetch";

function nodeTone(type: string) {
  if (type === "historical_fact") return "emerald" as const;
  if (type === "reasonable_inference") return "amber" as const;
  return "rose" as const;
}

function nodeLabel(type: string) {
  if (type === "historical_fact") return "史实";
  if (type === "reasonable_inference") return "推断";
  return "虚构分支";
}

export function CompanionWorkbench({ initialSessions }: { initialSessions: CompanionSessionDTO[] }) {
  const [sessions, setSessions] = useState(initialSessions);
  const [active, setActive] = useState<CompanionSessionDTO | null>(initialSessions[0] ?? null);
  const [form, setForm] = useState({
    principalName: "岳飞",
    companionName: "诸葛亮",
    goal: "在不破坏史实基线的前提下，尽力避免风波亭遗憾。",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function create() {
    setError(null);
    startTransition(async () => {
      try {
        const response = await secureFetch("/api/companion/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = (await response.json()) as { session?: CompanionSessionDTO; error?: string };
        if (!response.ok || !payload.session) {
          setError(payload.error ?? "创建失败。");
          return;
        }
        setSessions((current) => [payload.session as CompanionSessionDTO, ...current]);
        setActive(payload.session);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "创建失败。");
      }
    });
  }

  function action(kind: "advance" | "rollback" | "stop") {
    if (!active) return;
    startTransition(async () => {
      try {
        const response = await secureFetch(`/api/companion/sessions/${active.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: kind }),
        });
        const payload = (await response.json()) as { session?: CompanionSessionDTO; error?: string };
        if (!response.ok || !payload.session) {
          setError(payload.error ?? "更新失败。");
          return;
        }
        setActive(payload.session);
        setSessions((current) => current.map((session) => (session.id === payload.session?.id ? payload.session : session)));
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "更新失败。");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--line)] pb-7">
        <div className="page-kicker">
          <Route className="h-4 w-4 text-[var(--cinnabar)]" />
          时空伴游推演
        </div>
        <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">历史同行者</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          让一位同行者进入另一位历史人物的世界线，区分史实、合理推断与虚构分支。
        </p>
      </header>

      <section className="grid gap-6 xl:grid-cols-[0.86fr_1.14fr]">
        <Panel className="p-5 sm:p-6">
          <Badge tone="cyan">新世界线</Badge>
          <div className="mt-5 space-y-4">
            <label className="space-y-2 block">
              <span className="field-label">被协助者</span>
              <input className="ink-input" onChange={(event) => setForm((current) => ({ ...current, principalName: event.target.value }))} value={form.principalName} />
            </label>
            <label className="space-y-2 block">
              <span className="field-label">同行者</span>
              <input className="ink-input" onChange={(event) => setForm((current) => ({ ...current, companionName: event.target.value }))} value={form.companionName} />
            </label>
            <label className="space-y-2 block">
              <span className="field-label">历史遗憾 / 目标</span>
              <textarea className="ink-textarea" onChange={(event) => setForm((current) => ({ ...current, goal: event.target.value }))} value={form.goal} />
            </label>
            {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]" role="alert">{error}</p> : null}
            <Button className="w-full" disabled={isPending} onClick={create}>
              <GitBranch className="h-4 w-4" />
              创建世界线
            </Button>
          </div>

          <div className="mt-6 divide-y divide-[var(--line)]">
            {sessions.map((session) => (
              <button
                className="block w-full py-4 text-left"
                key={session.id}
                onClick={() => setActive(session)}
                type="button"
              >
                <div className="font-semibold text-[var(--ink)]">{session.title}</div>
                <div className="mt-1 text-xs text-[var(--muted)]">{session.nodes.length} 节点 · {session.status}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel className="docket-paper p-5 sm:p-6">
          {active ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-5">
                <div>
                  <Badge tone={active.status === "active" ? "emerald" : "neutral"}>{active.status}</Badge>
                  <h2 className="mt-3 font-serif text-3xl font-black text-[var(--ink)]">{active.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{active.goal}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={isPending || active.status !== "active"} onClick={() => action("advance")} size="sm">
                    <StepForward className="h-3.5 w-3.5" />
                    推进
                  </Button>
                  <Button disabled={isPending} onClick={() => action("rollback")} size="sm" variant="secondary">
                    <RotateCcw className="h-3.5 w-3.5" />
                    回滚
                  </Button>
                  <Button disabled={isPending || active.status !== "active"} onClick={() => action("stop")} size="sm" variant="danger">
                    <Square className="h-3.5 w-3.5" />
                    停止
                  </Button>
                </div>
              </div>

              <div className="relative mt-6 space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-[var(--line)]">
                {active.nodes.map((node) => (
                  <article className="relative pl-11" key={node.id}>
                    <span className="absolute left-[11px] top-3 h-3 w-3 rounded-full border border-[var(--cinnabar)] bg-[var(--paper)]" />
                    <div className="rounded-md border border-[var(--line)] bg-white/40 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Badge tone={nodeTone(node.nodeType)}>{nodeLabel(node.nodeType)}</Badge>
                        <span className="text-xs text-[var(--muted)]">风险：{node.riskLevel}</span>
                      </div>
                      <h3 className="mt-3 font-serif text-xl font-bold text-[var(--ink)]">{node.title}</h3>
                      <p className="mt-2 text-sm leading-7 text-[var(--ink-soft)]">{node.body}</p>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-sm text-[var(--muted)]">创建第一条世界线后，时间线会出现在这里。</div>
          )}
        </Panel>
      </section>
    </div>
  );
}
