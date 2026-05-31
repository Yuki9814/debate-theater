"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Activity,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CircleStop,
  Download,
  FastForward,
  FileJson,
  FileText,
  History,
  Lightbulb,
  Pause,
  Play,
  Scale,
  ShieldCheck,
  Trophy,
  UserCheck,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { DebateRoundDTO, DebateSessionDTO, OutputMode } from "@/lib/debate/types";
import { cn, estimateTokens, formatDateTime } from "@/lib/utils";

function scoreFor(round: DebateRoundDTO | undefined, side: "A" | "B") {
  return round?.scores.find((score) => score.side === side)?.total ?? 0;
}

function averageFor(rounds: DebateRoundDTO[], side: "A" | "B") {
  if (rounds.length === 0) return 0;
  return Math.round(rounds.reduce((sum, round) => sum + scoreFor(round, side), 0) / rounds.length);
}

function splitSentences(text: string) {
  return text
    .split(/(?<=[.!?。！？])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function statusTone(status: string): BadgeTone {
  if (status === "running") return "emerald";
  if (status === "awaiting_confirmation" || status === "paused") return "amber";
  if (status === "ended" || status === "stopped") return "rose";
  return "neutral";
}

function statusText(status: string) {
  const map: Record<string, string> = {
    draft: "已部署",
    running: "开庭中",
    paused: "断点暂停",
    awaiting_confirmation: "等待核准",
    ended: "裁决结案",
    stopped: "手动中止",
  };
  return map[status] ?? status;
}

function outputModeText(mode: string) {
  const map: Record<string, string> = {
    full: "整段输出",
    sentence: "逐句拆解",
    theater: "庭审摘录",
  };
  return map[mode] ?? mode;
}

function winnerText(winner: string | null) {
  if (!winner) return "未判定";
  if (winner === "A") return "甲方胜出";
  if (winner === "B") return "乙方胜出";
  if (winner === "Draw") return "判定平局";
  if (winner === "Stopped by user") return "手动停止";
  if (winner === "Round limit reached" || winner === "达到轮数上限") return "达到轮数上限";
  return winner;
}

function SpeechText({ text, mode, side }: { text: string; mode: OutputMode | string; side: "A" | "B" }) {
  const isA = side === "A";
  const colorClass = isA ? "border-[var(--cinnabar)]" : "border-[var(--lapis)]";

  if (mode === "sentence") {
    const sentences = splitSentences(text);
    return (
      <div className="space-y-3">
        {sentences.map((sentence, index) => (
          <p
            className={cn(
              "fade-in rounded-md border bg-white/55 p-3 text-sm leading-7 text-[var(--ink-soft)]",
              isA ? "border-[var(--cinnabar)]/25" : "border-[var(--lapis)]/25",
            )}
            key={`${sentence}-${index}`}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            {sentence}
          </p>
        ))}
      </div>
    );
  }

  if (mode === "theater") {
    return (
      <blockquote className={cn("border-l-4 py-1 pl-4", colorClass)}>
        <p className="font-serif text-base font-medium leading-9 text-[var(--ink)]">{text}</p>
      </blockquote>
    );
  }

  return <p className="whitespace-pre-wrap text-sm leading-8 text-[var(--ink-soft)]">{text}</p>;
}

function DebaterPanel({
  side,
  stance,
  content,
  score,
  mode,
  isActive,
}: {
  side: "A" | "B";
  stance: string;
  content: string;
  score: number;
  mode: OutputMode | string;
  isActive: boolean;
}) {
  const isA = side === "A";
  const tone = isA ? "rose" : "cyan";
  const title = isA ? "甲方席" : "乙方席";
  const sideLabel = isA ? "甲" : "乙";

  return (
    <Panel
      className={cn(
        "docket-paper flex min-h-[420px] flex-col overflow-hidden p-0 transition md:min-h-[560px]",
        isActive
          ? cn(
              "court-focus",
              isA ? "border-[var(--cinnabar)] text-[var(--cinnabar)]" : "border-[var(--lapis)] text-[var(--lapis)]",
            )
          : "opacity-80",
      )}
    >
      <div className={cn("border-b border-[var(--line)] p-5", isA ? "bg-[var(--cinnabar-soft)]/35" : "bg-[var(--lapis-soft)]/45")}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border font-serif text-xl font-black",
                isA
                  ? "border-[var(--cinnabar)] text-[var(--cinnabar)]"
                  : "border-[var(--lapis)] text-[var(--lapis)]",
              )}
            >
              {sideLabel}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone}>{title}</Badge>
                {isActive ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full ink-pulse",
                        isA ? "bg-[var(--cinnabar)]" : "bg-[var(--lapis)]",
                      )}
                    />
                    聚光陈词
                  </span>
                ) : null}
              </div>
              <h2 className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[var(--ink)]">{stance}</h2>
            </div>
          </div>

          <div className="shrink-0 rounded-md border border-[var(--line)] bg-white/55 px-3 py-2 text-right">
            <div className="text-[10px] font-semibold text-[var(--muted)]">得分</div>
            <div className="mt-1 font-serif text-2xl font-black text-[var(--ink)]">{score || "--"}</div>
          </div>
        </div>
      </div>

      <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
        {content ? (
          <SpeechText mode={mode} text={content} side={side} />
        ) : (
          <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-3 text-center text-sm text-[var(--muted)]">
            <Activity className="h-5 w-5 ink-pulse" />
            等待本席陈词落卷。
          </div>
        )}
      </div>
    </Panel>
  );
}

function JudgePanel({ session }: { session: DebateSessionDTO }) {
  const latest = session.rounds.at(-1);
  const aAverage = averageFor(session.rounds, "A");
  const bAverage = averageFor(session.rounds, "B");

  return (
    <Panel className="docket-paper overflow-hidden p-0">
      <div className="border-b border-[var(--line)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-[var(--brass)] bg-[var(--brass-soft)] text-[var(--brass)]">
              <Scale className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={statusTone(session.status)}>状态：{statusText(session.status)}</Badge>
                <span className="text-xs text-[var(--muted)]">
                  置信度：{latest ? `${Math.round(latest.confidence * 100)}%` : "--"}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">中央裁判席</h2>
            </div>
          </div>

          <div className="text-right">
            <div className="font-serif text-4xl font-black text-[var(--ink)]">{session.currentRound}</div>
            <div className="text-xs text-[var(--muted)]">/ {session.maxRounds} 回合</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="rounded-md border border-[var(--line)] bg-white/42 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
            <UserCheck className="h-4 w-4" />
            本轮判词
          </div>
          <p className="line-clamp-5 text-sm leading-7 text-[var(--ink-soft)]">
            {latest?.judgeSummary ?? "等待首轮陈词落卷，裁判将出示判词。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
            <span>断点复核：{session.pauseEveryRounds} 轮</span>
            <span>低分线：{session.lowScoreThreshold}</span>
          </div>
        </div>

        <div className="rounded-md border border-[var(--line)] bg-white/42 p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Trophy className="h-4 w-4 text-[var(--brass)]" />
            席次均分
          </div>
          <div className="space-y-4">
            {[
              { label: "甲方", score: aAverage, color: "bg-[var(--cinnabar)]" },
              { label: "乙方", score: bAverage, color: "bg-[var(--lapis)]" },
            ].map((item) => (
              <div key={item.label}>
                <div className="mb-1.5 flex justify-between text-xs text-[var(--muted)]">
                  <span>{item.label}</span>
                  <span className="font-semibold text-[var(--ink)]">{item.score || "--"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--paper-quiet)]">
                  <div className={cn("h-full rounded-full transition-all duration-500", item.color)} style={{ width: `${item.score}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

type ExportResponse = {
  export?: {
    format: "markdown" | "json";
    filename: string;
    content: string;
    canDownload: boolean;
    previewOnly: boolean;
    upgradeRequired: boolean;
    planId: string;
  };
  error?: string;
};

function RecapPanel({ session }: { session: DebateSessionDTO }) {
  const [exportState, setExportState] = useState<{
    loading: "markdown" | "json" | null;
    message: string | null;
    preview: string | null;
    error: string | null;
  }>({
    loading: null,
    message: null,
    preview: null,
    error: null,
  });

  async function requestExport(format: "markdown" | "json") {
    setExportState({ loading: format, message: null, preview: null, error: null });
    try {
      const response = await fetch(`/api/debate/sessions/${session.id}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format }),
      });
      const payload = (await response.json()) as ExportResponse;
      if (!response.ok || !payload.export) {
        throw new Error(payload.error ?? "导出失败。");
      }

      if (!payload.export.canDownload) {
        setExportState({
          loading: null,
          message: "免费版展示导出预览；升级 Pro 后可下载完整卷宗。",
          preview: payload.export.content,
          error: null,
        });
        return;
      }

      const blob = new Blob([payload.export.content], {
        type: format === "markdown" ? "text/markdown;charset=utf-8" : "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = payload.export.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setExportState({ loading: null, message: "完整卷宗已开始下载。", preview: null, error: null });
    } catch (exportError) {
      setExportState({
        loading: null,
        message: null,
        preview: null,
        error: exportError instanceof Error ? exportError.message : "导出失败。",
      });
    }
  }

  return (
    <Panel className="p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-[var(--brass)]" />
          <h2 className="font-serif text-lg font-bold text-[var(--ink)]">复盘摘要</h2>
        </div>
        <Badge tone={session.exportAvailable ? "emerald" : "neutral"}>
          {session.exportAvailable ? "可预览导出" : "等待首轮"}
        </Badge>
      </div>

      <p className="text-sm leading-7 text-[var(--ink-soft)]">
        {session.recapSummary ?? "生成首轮后，这里会沉淀胜负理由、关键论点与薄弱环节。"}
      </p>

      {session.keyArguments.length > 0 ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-md border border-[var(--line)] bg-white/35 p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--muted)]">关键论点</div>
            <ul className="space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
              {session.keyArguments.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-md border border-[var(--line)] bg-white/35 p-3">
            <div className="mb-2 text-xs font-semibold text-[var(--muted)]">薄弱环节</div>
            <ul className="space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
              {session.weaknesses.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={!session.exportAvailable || exportState.loading !== null}
          onClick={() => void requestExport("markdown")}
          size="sm"
          title="导出 Markdown 卷宗；免费版先展示预览"
          variant="secondary"
        >
          <FileText className="h-3.5 w-3.5" />
          Markdown
        </Button>
        <Button
          disabled={!session.exportAvailable || exportState.loading !== null}
          onClick={() => void requestExport("json")}
          size="sm"
          title="导出 JSON 数据；免费版先展示预览"
          variant="secondary"
        >
          <FileJson className="h-3.5 w-3.5" />
          JSON
        </Button>
        <Button disabled size="sm" title="Pro 解锁完整下载" variant="ghost">
          <Download className="h-3.5 w-3.5" />
          Pro 下载
        </Button>
      </div>

      {exportState.message ? (
        <div className="mt-4 rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)] p-3 text-xs leading-5 text-[var(--brass)]">
          {exportState.message}
        </div>
      ) : null}
      {exportState.error ? (
        <div className="mt-4 flex gap-2 rounded-md border border-[var(--rose)]/35 bg-[var(--rose-soft)] p-3 text-xs leading-5 text-[var(--rose)]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {exportState.error}
        </div>
      ) : null}
      {exportState.preview ? (
        <pre className="thin-scrollbar mt-4 max-h-52 overflow-auto rounded-md border border-[var(--line)] bg-[var(--paper-quiet)] p-3 text-[11px] leading-5 text-[var(--ink-soft)]">
          {exportState.preview}
        </pre>
      ) : null}
    </Panel>
  );
}

function RoundTimeline({ rounds }: { rounds: DebateRoundDTO[] }) {
  return (
    <Panel className="flex max-h-[400px] min-h-[320px] flex-col p-5">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-[var(--lapis)]" />
          <h2 className="font-serif text-lg font-bold text-[var(--ink)]">卷宗进程</h2>
        </div>
        <Badge tone="cyan">{rounds.length} 回合</Badge>
      </div>

      <div className="thin-scrollbar flex-1 space-y-3 overflow-y-auto pr-1">
        {rounds.length === 0 ? (
          <div className="flex min-h-[200px] items-center justify-center text-center text-sm text-[var(--muted)]">
            暂无回合卷页。
          </div>
        ) : (
          rounds
            .slice()
            .reverse()
            .map((round) => (
              <article className="rounded-md border border-[var(--line)] bg-white/40 p-3" key={round.id}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] pb-2">
                  <div className="text-sm font-bold text-[var(--ink)]">第 {round.roundNumber} 轮</div>
                  <div className="text-xs text-[var(--muted)]">{formatDateTime(round.createdAt)}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-[var(--cinnabar-soft)] px-2 py-1 text-[var(--cinnabar)]">
                    甲 {scoreFor(round, "A")}
                  </span>
                  <span className="rounded-full bg-[var(--lapis-soft)] px-2 py-1 text-[var(--lapis)]">
                    乙 {scoreFor(round, "B")}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{round.judgeSummary}</p>
              </article>
            ))
        )}
      </div>
    </Panel>
  );
}

function ControlConsole({
  session,
  isPending,
  onStart,
  onPause,
  onResume,
  onStop,
  onNext,
  onForce,
}: {
  session: DebateSessionDTO;
  isPending: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onNext: () => void;
  onForce: (winner: string) => void;
}) {
  const canRun = session.status === "draft" || session.status === "paused" || session.status === "awaiting_confirmation";
  const isRunning = session.status === "running";
  const isClosed = session.status === "ended" || session.status === "stopped";
  const [isExpanded, setIsExpanded] = useState(false);
  const nextRound = Math.min(session.currentRound + 1, session.maxRounds);
  const resumeLabel = session.status === "awaiting_confirmation" || session.status === "paused" ? `继续第 ${nextRound} 轮` : "续审";

  const statusColor = isRunning
    ? "bg-[var(--jade)]"
    : session.status === "paused" || session.status === "awaiting_confirmation"
      ? "bg-[var(--brass)]"
      : "bg-[var(--muted-light)]";

  return (
    <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-40 rounded-md border border-[var(--line)] bg-[var(--console-bg)] px-3 py-2 shadow-[var(--console-shadow)] backdrop-blur-xl md:inset-x-0 md:bottom-0 md:left-[76px] md:rounded-none md:border-x-0 md:border-b-0 md:px-4 md:py-3">
      <div className="mx-auto flex max-w-[1364px] flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full ink-pulse", statusColor)} />
          <div>
            <span className="block text-xs text-[var(--muted)]">庭务状态</span>
            <span className="mt-0.5 block text-sm font-semibold text-[var(--ink)]">{statusText(session.status)}</span>
          </div>
        </div>

        <button
          aria-expanded={isExpanded}
          className="flex items-center gap-1 rounded-md border border-[var(--line)] bg-white/55 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] md:hidden"
          onClick={() => setIsExpanded((value) => !value)}
          type="button"
        >
          庭务
          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
        </button>

        <div className={cn("flex flex-wrap items-center gap-2", !isExpanded && "hidden md:flex")}>
          {session.status === "draft" ? (
            <Button disabled={isPending || isClosed} onClick={onStart} size="sm" title="开始自动生成第一轮攻防">
              <Play className="h-3.5 w-3.5" />
              开庭
            </Button>
          ) : (
            <>
              <Button disabled={isPending || !isRunning} onClick={onPause} size="sm" title="暂停生成，保留当前卷宗状态" variant="secondary">
                <Pause className="h-3.5 w-3.5" />
                断点
              </Button>
              <Button disabled={isPending || !canRun || isClosed} onClick={onResume} size="sm" title={`继续生成第 ${nextRound} 轮`}>
                <Play className="h-3.5 w-3.5" />
                {resumeLabel}
              </Button>
            </>
          )}
          <Button disabled={isPending || isClosed} onClick={onNext} size="sm" title={`手动生成第 ${nextRound} 轮`} variant="secondary">
            <FastForward className="h-3.5 w-3.5" />
            下一轮
          </Button>
          <Button disabled={isPending || isClosed} onClick={onStop} size="sm" title="停止辩论并保留已有卷宗" variant="danger">
            <CircleStop className="h-3.5 w-3.5" />
            休庭
          </Button>
        </div>

        <div className={cn("items-center gap-2 border-l border-[var(--line)] pl-4", isExpanded ? "flex" : "hidden md:flex")}>
          <span className="hidden text-xs text-[var(--muted)] sm:inline">强制裁决</span>
          <div className="flex items-center gap-1">
            {[
              ["A", "甲胜"],
              ["B", "乙胜"],
              ["Draw", "平局"],
            ].map(([winner, label]) => (
              <button
                className="rounded-md border border-[var(--line)] bg-white/45 px-2.5 py-1.5 text-xs font-semibold text-[var(--muted)] transition hover:border-[var(--ink)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-40"
                disabled={isPending || isClosed}
                key={winner}
                onClick={() => onForce(winner)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function DebateRoom({ initialSession }: { initialSession: DebateSessionDTO }) {
  const [session, setSession] = useState(initialSession);
  const [error, setError] = useState<string | null>(null);
  const [isRoundRunning, setIsRoundRunning] = useState(false);
  const [isPending, startTransition] = useTransition();
  const lockRef = useRef(false);
  const latest = session.rounds.at(-1);
  const participantA = session.participants.find((item) => item.side === "A");
  const participantB = session.participants.find((item) => item.side === "B");

  const totalTokens = useMemo(
    () =>
      session.rounds.reduce(
        (sum, round) => sum + estimateTokens(round.speakerAContent + round.speakerBContent + round.judgeSummary),
        0,
      ),
    [session.rounds],
  );

  async function patchSession(body: { status?: string; winner?: string | null; maxRounds?: number }) {
    const response = await fetch(`/api/debate/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as { session?: DebateSessionDTO; error?: string };
    if (!response.ok || !payload.session) throw new Error(payload.error ?? "辩场更新失败。");
    setSession(payload.session);
    return payload.session;
  }

  const runRound = useCallback(async () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIsRoundRunning(true);
    setError(null);

    try {
      const response = await fetch(`/api/debate/sessions/${initialSession.id}/rounds`, {
        method: "POST",
      });
      const payload = (await response.json()) as { session?: DebateSessionDTO; error?: string };
      if (!response.ok || !payload.session) throw new Error(payload.error ?? "回合生成失败。");
      setSession(payload.session);
    } catch (roundError) {
      setError(roundError instanceof Error ? roundError.message : "回合生成失败。");
    } finally {
      lockRef.current = false;
      setIsRoundRunning(false);
    }
  }, [initialSession.id]);

  function transition(task: () => Promise<void>) {
    startTransition(() => {
      void task();
    });
  }

  useEffect(() => {
    if (session.status !== "running" || lockRef.current) return;
    const timer = window.setTimeout(() => {
      void runRound();
    }, session.currentRound === 0 ? 200 : 1200);
    return () => window.clearTimeout(timer);
  }, [runRound, session.status, session.currentRound]);

  const isAActive = session.status === "running" || (latest !== undefined && scoreFor(latest, "A") >= scoreFor(latest, "B"));
  const isBActive = session.status === "running" || (latest !== undefined && scoreFor(latest, "B") >= scoreFor(latest, "A"));
  const progress = Math.min(100, Math.round((session.currentRound / Math.max(session.maxRounds, 1)) * 100));

  return (
    <div className="pb-[calc(15rem+env(safe-area-inset-bottom))] md:pb-28">
      <header className="mb-6 border-b border-[var(--line)] pb-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="cyan">自由议席</Badge>
              <span className="text-xs text-[var(--muted)]">卷宗 {session.id.slice(0, 8)}</span>
            </div>
            <h1 className="mt-4 max-w-5xl font-serif text-3xl font-black leading-tight text-[var(--ink)] sm:text-4xl">
              {session.topic}
            </h1>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-[var(--muted)]">
              <span>呈现：{outputModeText(session.outputMode)}</span>
              <span>卷宗估算：{totalTokens.toLocaleString()} 令牌</span>
              <span>裁决：{winnerText(session.winner)}</span>
            </div>
          </div>
          <ShieldCheck className="h-6 w-6 text-[var(--jade)]" />
        </div>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-[var(--paper-quiet)]">
          <div className="h-full rounded-full bg-[var(--cinnabar)] transition-all duration-500" style={{ width: `${progress}%` }} />
        </div>
      </header>

      {session.status === "awaiting_confirmation" ? (
        <div className="mb-5 rounded-md border border-[var(--brass)]/35 bg-[var(--brass-soft)] p-4 text-sm text-[var(--brass)]">
          庭审触发断点复核：第 {session.currentRound} 轮已挂起。下一步可继续生成第{" "}
          {Math.min(session.currentRound + 1, session.maxRounds)} 轮。
        </div>
      ) : null}

      {error ? (
        <div className="mb-5 rounded-md border border-[var(--rose)]/35 bg-[var(--rose-soft)] p-4 text-sm text-[var(--rose)]">
          庭务调用故障：{error}
        </div>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.06fr)_360px_minmax(0,1.06fr)]">
        <div className="order-2 xl:order-1">
          <DebaterPanel
            content={latest?.speakerAContent ?? ""}
            isActive={isAActive}
            mode={session.outputMode}
            score={scoreFor(latest, "A")}
            side="A"
            stance={participantA?.stance ?? "正方：主张成立"}
          />
        </div>

        <div className="order-1 space-y-5 xl:order-2">
          <JudgePanel session={session} />
          <RecapPanel session={session} />
          <RoundTimeline rounds={session.rounds} />
        </div>

        <div className="order-3 xl:order-3">
          <DebaterPanel
            content={latest?.speakerBContent ?? ""}
            isActive={isBActive}
            mode={session.outputMode}
            score={scoreFor(latest, "B")}
            side="B"
            stance={participantB?.stance ?? "反方：主张不成立"}
          />
        </div>
      </div>

      <ControlConsole
        isPending={isPending || isRoundRunning}
        onForce={(winner) =>
          transition(async () => {
            await patchSession({ status: "ended", winner });
          })
        }
        onNext={() => transition(runRound)}
        onPause={() =>
          transition(async () => {
            await patchSession({ status: "paused" });
          })
        }
        onResume={() =>
          transition(async () => {
            await patchSession({ status: "running" });
          })
        }
        onStart={() =>
          transition(async () => {
            await patchSession({ status: "running" });
          })
        }
        onStop={() =>
          transition(async () => {
            await patchSession({ status: "stopped", winner: "Stopped by user" });
          })
        }
        session={session}
      />
    </div>
  );
}
