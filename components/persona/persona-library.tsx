"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { PersonaPreset } from "@/lib/persona/presets";

export function PersonaLibrary({ personas }: { personas: PersonaPreset[] }) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return personas;
    return personas.filter((persona) =>
      [persona.name, persona.era, persona.category, persona.coreBeliefs, persona.speakingStyle]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [personas, query]);

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--line)] pb-7">
        <div className="page-kicker">
          <UserPlus className="h-4 w-4 text-[var(--cinnabar)]" />
          历史镜像人格
        </div>
        <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">人格库</h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          首批预设覆盖思想家、哲学家、军事家、文学家、政治家与科学家。开人格辩论时会注入经历、信念、口吻与盲点。
        </p>
      </header>

      <Panel className="p-4 sm:p-5">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="space-y-2">
            <span className="field-label">检索人格</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input className="ink-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="孔子、军事家、法家、冷峻..." value={query} />
            </div>
          </label>
          <div className="flex items-end">
            <Link className={buttonVariants({ variant: "primary", size: "md" })} href="/debate/setup">
              用人格开辩
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((persona) => (
          <Panel className="p-5" key={persona.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Badge tone="rose">{persona.category}</Badge>
                <h2 className="mt-3 font-serif text-2xl font-bold text-[var(--ink)]">{persona.name}</h2>
                <p className="mt-1 text-xs text-[var(--muted)]">{persona.era}</p>
              </div>
              <span className="rounded-md border border-[var(--line)] bg-white/35 px-2 py-1 text-xs text-[var(--muted)]">
                {persona.sampleTone}
              </span>
            </div>
            <p className="mt-4 text-sm leading-7 text-[var(--ink-soft)]">{persona.description}</p>
            <div className="mt-4 grid gap-3 text-xs leading-5 text-[var(--muted)]">
              <div>
                <span className="font-semibold text-[var(--ink)]">核心信念：</span>
                {persona.coreBeliefs}
              </div>
              <div>
                <span className="font-semibold text-[var(--ink)]">表达风格：</span>
                {persona.speakingStyle}
              </div>
              <div>
                <span className="font-semibold text-[var(--ink)]">盲点：</span>
                {persona.blindSpots}
              </div>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
