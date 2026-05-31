"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Network, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type SourceCard = {
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
};

export function ResearchWorkbench() {
  const [topic, setTopic] = useState("人工智能生成内容是否应该强制标识来源与生成方式？");
  const [cards, setCards] = useState<SourceCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function collect() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/research/source-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      const payload = (await response.json()) as { sourceCards?: SourceCard[]; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "资料包生成失败。");
        return;
      }
      setCards(payload.sourceCards ?? []);
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
        {error ? <p className="mt-4 rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}
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
