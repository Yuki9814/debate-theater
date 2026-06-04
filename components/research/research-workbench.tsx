"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Network, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { secureFetch } from "@/lib/security/secure-fetch";

type SourceCard = {
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
};

type SourceMode = "live" | "fallback";

export function ResearchWorkbench() {
  const [topic, setTopic] = useState("人工智能生成内容是否应该强制标识来源与生成方式？");
  const [cards, setCards] = useState<SourceCard[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function collect() {
    setError(null);
    setSourceMode(null);
    startTransition(async () => {
      try {
        const response = await secureFetch("/api/research/source-cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic }),
        });
        const payload = (await response.json()) as { sourceCards?: SourceCard[]; sourceMode?: SourceMode; error?: string };
        if (!response.ok) {
          setError(payload.error ?? "资料包生成失败。");
          return;
        }
        setCards(payload.sourceCards ?? []);
        setSourceMode(payload.sourceMode ?? null);
      } catch (collectError) {
        setError(collectError instanceof Error ? collectError.message : "资料包生成失败。");
      }
    });
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--line)] pb-7">
        <div className="page-kicker">
          <Network className="h-4 w-4 text-[var(--cinnabar)]" />
          联网事实检索
        </div>
        <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">热点资料席</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          开辩前生成共享资料包，裁判会对无来源断言、歪曲来源和过期事实扣分。
        </p>
      </header>

      <Panel className="p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] md:items-end">
          <label className="space-y-2">
            <span className="field-label">热点议题</span>
            <input className="ink-input" onChange={(event) => setTopic(event.target.value)} value={topic} />
          </label>
          <Button disabled={isPending} onClick={collect} variant="secondary">
            <Search className="h-4 w-4" />
            {isPending ? "检索中" : "生成资料包"}
          </Button>
          <Link className={buttonVariants({ variant: "primary", size: "md" })} href={`/debate/setup?topic=${encodeURIComponent(topic)}`}>
            用此题开辩
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {sourceMode ? (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-[var(--line)] bg-white/35 p-3 text-xs leading-5 text-[var(--muted)]">
            <Badge tone={sourceMode === "live" ? "emerald" : "amber"}>
              {sourceMode === "live" ? "实时搜索结果" : "本地占位资料"}
            </Badge>
            {sourceMode === "live"
              ? "资料包来自搜索服务返回结果，裁判仍会要求交叉验证。"
              : "当前未配置实时搜索凭据；结果只是可点击审查入口，不能当作已抓取正文。"}
          </div>
        ) : null}
        {error ? <p className="mt-4 rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]" role="alert">{error}</p> : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Panel className="p-5" key={`${card.sourceName}-${card.title}`}>
            <div className="flex items-start justify-between gap-3">
              <Badge tone="cyan">{card.sourceName}</Badge>
              <span className="text-xs text-[var(--muted)]">{card.publishedTime}</span>
            </div>
            <a className="mt-4 block font-serif text-xl font-bold leading-7 text-[var(--ink)] hover:text-[var(--cinnabar)]" href={card.url} rel="noreferrer" target="_blank">
              {card.title}
            </a>
            <p className="mt-3 text-sm leading-7 text-[var(--ink-soft)]">{card.summary}</p>
            <p className="mt-4 rounded-md border border-[var(--brass)]/30 bg-[var(--brass-soft)] p-3 text-xs leading-5 text-[var(--brass)]">
              {card.reliabilityNote}
            </p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
