"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, Database, Network, Scale, Search, Sparkles, Users } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { defaultDebateSetup, providerOptions, type DebateMode, type DebateSetupInput } from "@/lib/debate/types";
import { personaPresets, recommendPersonaTopics } from "@/lib/persona/presets";
import { conversionScenarios } from "@/lib/product/conversion";
import { secureFetch } from "@/lib/security/secure-fetch";

type ProviderView = {
  id: string;
  providerName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
};

type PersonaView = {
  id: string;
  name: string;
  era?: string | null;
  category: string;
  coreBeliefs: string;
  speakingStyle: string;
};

type SourceCardPreview = {
  title: string;
  sourceName: string;
  summary: string;
  reliabilityNote: string;
};

type SourceMode = "live" | "fallback";

type ProviderKey = "providerA" | "providerB" | "providerJudge";
type ModelKey = "modelA" | "modelB" | "modelJudge";
type SeatRole = "A" | "B" | "Judge";

type ProviderChoice = {
  id: string;
  label: string;
  model: string;
  kind: "built-in" | "saved";
};

type SeatConfig = {
  label: string;
  shortLabel: string;
  providerKey: ProviderKey;
  modelKey: ModelKey;
  role: SeatRole;
  tone: BadgeTone;
};

const seatConfigs: SeatConfig[] = [
  { label: "甲方席接入器", shortLabel: "甲方", providerKey: "providerA", modelKey: "modelA", role: "A", tone: "rose" },
  { label: "乙方席接入器", shortLabel: "乙方", providerKey: "providerB", modelKey: "modelB", role: "B", tone: "cyan" },
  { label: "裁判席接入器", shortLabel: "裁判", providerKey: "providerJudge", modelKey: "modelJudge", role: "Judge", tone: "amber" },
];

const builtInSeatModels: Record<string, Record<SeatRole, string>> = {
  mock: {
    A: "mock-theater-a",
    B: "mock-theater-b",
    Judge: "mock-judge",
  },
  openai: {
    A: "gpt-4.1-mini",
    B: "gpt-4.1-mini",
    Judge: "gpt-4.1-mini",
  },
  "custom-openai": {
    A: "gpt-4.1-mini",
    B: "gpt-4.1-mini",
    Judge: "gpt-4.1-mini",
  },
};

const PRESET_TOPICS = [
  {
    topic: "人工智能未来是否应该被赋予法律主体地位与道德权利义务？",
    sideA: "应当赋予，以确立算力责任归宿与伦理边界",
    sideB: "不应赋予，AI 仅为人类延伸工具而非生命主体",
  },
  {
    topic: "大都市圈核心区域是否应当全面禁止私家非纯电载客车辆驶入？",
    sideA: "应当禁行，用物理手段倒逼绿色微循环与公共交通",
    sideB: "不宜禁行，此举剥夺市民路权且损害城市商业活力",
  },
  {
    topic: "基因编辑技术是否应当被允许用于非致病性人类表型定制？",
    sideA: "允许使用，这是人类主动优化自身进化轨迹的合理探索",
    sideB: "严格禁止，极易诱发社会阶层固化与伦理失控风险",
  },
];

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      <input className="ink-input" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} type="number" value={value} />
    </label>
  );
}

function modeTone(mode: DebateMode) {
  if (mode === "persona") return "rose" as const;
  if (mode === "research") return "cyan" as const;
  return "emerald" as const;
}

function modeLabel(mode: DebateMode | string) {
  const map: Record<string, string> = {
    free: "自由辩论",
    persona: "人格辩论",
    research: "热点联网",
    companion: "同行者",
  };
  return map[mode] ?? mode;
}

function outputModeLabel(mode: DebateSetupInput["outputMode"]) {
  const map: Record<string, string> = {
    theater: "庭审摘录",
    sentence: "逐句拆解",
    full: "原文整段",
  };
  return map[mode] ?? mode;
}

function personaStance(persona: PersonaView | undefined, side: "A" | "B") {
  if (!persona) return undefined;
  return side === "A"
    ? `${persona.name}以其思想与经历支持本方主张`
    : `${persona.name}以其思想与经历反驳本方主张`;
}

export function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const scenarioId = searchParams.get("scenario");
  const scenario = conversionScenarios.find((item) => item.id === scenarioId);
  const queryTopic = searchParams.get("topic")?.trim();
  const [providers, setProviders] = useState<ProviderView[]>([]);
  const [personas, setPersonas] = useState<PersonaView[]>(personaPresets);
  const [sourcePreview, setSourcePreview] = useState<SourceCardPreview[]>([]);
  const [sourceMode, setSourceMode] = useState<SourceMode | null>(null);
  const [form, setForm] = useState<DebateSetupInput>({
    ...defaultDebateSetup,
    topic: scenario?.topic ?? queryTopic ?? "人工智能未来是否应该被赋予法律主体地位与道德权利义务？",
    sideA: scenario?.sideA,
    sideB: scenario?.sideB,
    stanceMode: scenario ? "custom" : "auto",
    modelA: "mock-theater-a",
    modelB: "mock-theater-b",
    modelJudge: "mock-judge",
    outputMode: "theater",
    personaAId: "confucius",
    personaBId: "hanfeizi",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/providers")
      .then((response) => response.json())
      .then((payload: { providers?: ProviderView[] }) => {
        setProviders((payload.providers ?? []).filter((provider) => provider.enabled));
      })
      .catch(() => setError("读取接入器失败，请稍后刷新。"));
    void fetch("/api/personas")
      .then((response) => response.json())
      .then((payload: { personas?: PersonaView[] }) => {
        if (payload.personas?.length) setPersonas(payload.personas);
      })
      .catch(() => setError("读取人格库失败，请稍后刷新。"));
  }, []);

  const providerChoices = useMemo<ProviderChoice[]>(
    () => [
      ...providerOptions.map((provider) => ({
        id: provider.id,
        label: provider.name,
        model: builtInSeatModels[provider.id]?.A ?? "gpt-4.1-mini",
        kind: "built-in" as const,
      })),
      ...providers.map((provider) => ({
        id: provider.id,
        label: `${provider.providerName} · ${provider.defaultModel ?? "默认模型"}`,
        model: provider.defaultModel ?? "",
        kind: "saved" as const,
      })),
    ],
    [providers],
  );
  const providerChoicesById = useMemo(
    () => new Map(providerChoices.map((provider) => [provider.id, provider])),
    [providerChoices],
  );

  const personaA = personas.find((persona) => persona.id === form.personaAId);
  const personaB = personas.find((persona) => persona.id === form.personaBId);
  const recommendedTopics =
    personaA && personaB ? recommendPersonaTopics(personaA.name, personaB.name) : [];
  const topicLength = form.topic.trim().length;
  const pauseEstimate = Math.floor(form.maxRounds / form.pauseEveryRounds);
  const blockingIssues = [
    topicLength < 4 ? "辩题至少需要 4 个字。" : null,
    form.stanceMode === "custom" && (!form.sideA?.trim() || !form.sideB?.trim())
      ? "手写立场需要补齐甲乙两席主张。"
      : null,
    form.mode === "persona" && (!form.personaAId || !form.personaBId)
      ? "人格辩论需要选择甲乙两位身份。"
      : null,
  ].filter(Boolean);
  const advisoryNotes = [
    form.mode === "research" && sourcePreview.length === 0 ? "热点联网建议先预览资料包，便于确认来源口径。" : null,
    form.mode === "research" && sourceMode === "fallback" ? "当前资料包是本地占位入口，还不是实时联网抓取结果。" : null,
    form.pauseEveryRounds >= form.maxRounds ? "断点频率不小于最大回合，本场可能不会自动停顿复核。" : null,
    form.judgeConfidence < 0.65 ? "裁判置信度较低，较容易提前触发结案。" : null,
  ].filter(Boolean);
  const readinessTone: BadgeTone = blockingIssues.length ? "rose" : advisoryNotes.length ? "amber" : "emerald";

  function update<K extends keyof DebateSetupInput>(key: K, value: DebateSetupInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function defaultModelFor(providerId: string, role: SeatRole) {
    return builtInSeatModels[providerId]?.[role] ?? providerChoicesById.get(providerId)?.model ?? "";
  }

  function selectProvider(providerKey: ProviderKey, modelKey: ModelKey, role: SeatRole, providerId: string) {
    setForm((current) => ({
      ...current,
      [providerKey]: providerId,
      [modelKey]: defaultModelFor(providerId, role),
    }));
  }

  function selectPersona(key: "personaAId" | "personaBId", value: string) {
    const selected = personas.find((persona) => persona.id === value);
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(current.mode === "persona" && key === "personaAId"
        ? { sideA: personaStance(selected, "A") ?? current.sideA }
        : {}),
      ...(current.mode === "persona" && key === "personaBId"
        ? { sideB: personaStance(selected, "B") ?? current.sideB }
        : {}),
    }));
  }

  function setMode(mode: DebateMode) {
    setForm((current) => ({
      ...current,
      mode,
      stanceMode: mode === "persona" ? "custom" : current.stanceMode,
      sideA: mode === "persona" ? personaStance(personaA, "A") ?? current.sideA : current.sideA,
      sideB: mode === "persona" ? personaStance(personaB, "B") ?? current.sideB : current.sideB,
      researchQuery: mode === "research" ? current.topic : current.researchQuery,
    }));
  }

  function applyPreset(preset: (typeof PRESET_TOPICS)[number]) {
    setForm((current) => ({
      ...current,
      topic: preset.topic,
      sideA: preset.sideA,
      sideB: preset.sideB,
      stanceMode: "custom",
    }));
  }

  async function previewSources() {
    setError(null);
    setSourceMode(null);
    try {
      const response = await secureFetch("/api/research/source-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: form.researchQuery || form.topic }),
      });
      const payload = (await response.json()) as { sourceCards?: SourceCardPreview[]; sourceMode?: SourceMode; error?: string };
      if (!response.ok) {
        setError(payload.error ?? "资料包生成失败。");
        return;
      }
      setSourcePreview(payload.sourceCards ?? []);
      setSourceMode(payload.sourceMode ?? null);
    } catch (sourceError) {
      setError(sourceError instanceof Error ? sourceError.message : "资料包生成失败。");
    }
  }

  async function submit() {
    setError(null);
    const sideA = form.sideA?.trim() ?? "";
    const sideB = form.sideB?.trim() ?? "";
    if (form.stanceMode === "custom" && (!sideA || !sideB)) {
      setError("手动立场需要同时写明甲方与乙方主张。");
      return;
    }
    if (form.mode === "persona" && (!form.personaAId || !form.personaBId)) {
      setError("人格辩论需要同时选择甲乙两位身份。");
      return;
    }

    const preparedForm: DebateSetupInput = {
      ...form,
      topic: form.topic.trim(),
      sideA: sideA || undefined,
      sideB: sideB || undefined,
      researchQuery: form.researchQuery?.trim() || form.topic.trim(),
    };

    startTransition(async () => {
      try {
        const response = await secureFetch("/api/debate/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preparedForm),
        });
        const payload = (await response.json()) as { session?: { id: string }; error?: string };
        if (!response.ok || !payload.session) {
          setError(payload.error ?? "创建辩论失败。");
          return;
        }
        router.push(`/debate/${payload.session.id}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "创建辩论失败。");
      }
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Panel className="docket-paper overflow-hidden p-0">
        <div className="border-b border-[var(--line)] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="page-kicker">
                <Sparkles className="h-4 w-4 text-[var(--cinnabar)]" />
                多模式开庭
              </div>
              <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">立卷并开庭</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
                四步完成开庭：选模式、定议题、设规则、核对席位。mock 模式无需真实密钥。
              </p>
            </div>
            <div className="grid min-w-[220px] gap-2 text-xs text-[var(--muted)]">
              {["模式", "议题", "规则", "复核"].map((step, index) => (
                <div className="flex items-center gap-2" key={step}>
                  <span className="flex h-6 w-6 items-center justify-center rounded-md border border-[var(--line)] bg-white/45 font-serif font-bold text-[var(--ink)]">
                    {index + 1}
                  </span>
                  <span className="font-semibold">{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-7 p-5 sm:p-7">
          <section className="grid gap-3 md:grid-cols-3">
            {[
              { id: "free" as const, label: "自由辩论", icon: Scale, body: "自动分正反或手写双方立场。" },
              { id: "persona" as const, label: "人格辩论", icon: Users, body: "选择两位历史人格，按身份风格攻防。", phase: "Beta" },
              { id: "research" as const, label: "热点联网", icon: Network, body: "先生成共享资料包，再进行事实约束辩论。", phase: "预览" },
            ].map((item) => {
              const Icon = item.icon;
              const active = form.mode === item.id;
              return (
                <button
                  className={active ? "rounded-md border border-[var(--cinnabar)] bg-[var(--cinnabar-soft)] p-4 text-left" : "rounded-md border border-[var(--line)] bg-white/35 p-4 text-left transition hover:border-[var(--cinnabar)]"}
                  key={item.id}
                  onClick={() => setMode(item.id)}
                  type="button"
                >
                  <Icon className="h-5 w-5 text-[var(--cinnabar)]" />
                  <div className="mt-3 flex flex-wrap items-center gap-2 font-serif text-lg font-bold text-[var(--ink)]">
                    {item.label}
                    {item.phase ? <Badge tone="amber">{item.phase}</Badge> : null}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
                </button>
              );
            })}
          </section>

          <section className="rounded-md border border-[var(--line)] bg-white/35 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <span className="field-label justify-start gap-2">
                <BookOpen className="h-3.5 w-3.5 text-[var(--cinnabar)]" />
                高频开题
              </span>
              <Badge tone={modeTone(form.mode as DebateMode)}>{modeLabel(form.mode)}</Badge>
            </div>
            <div className="grid gap-2 lg:grid-cols-3">
              {PRESET_TOPICS.map((preset, index) => (
                <button
                  className="rounded-md border border-[var(--line)] bg-[var(--bg-glass)] p-3 text-left text-sm leading-6 text-[var(--ink-soft)] transition hover:border-[var(--cinnabar)] hover:bg-white/70"
                  key={preset.topic}
                  onClick={() => applyPreset(preset)}
                  type="button"
                >
                  <span className="mr-2 font-serif text-base font-bold text-[var(--cinnabar)]">{index + 1}</span>
                  {preset.topic}
                </button>
              ))}
            </div>
          </section>

          {form.mode === "persona" ? (
            <section className="grid gap-4 md:grid-cols-2">
              {[
                ["personaAId", "甲方人格", personaA],
                ["personaBId", "乙方人格", personaB],
              ].map(([key, label, selected]) => (
                <label className="space-y-2" key={String(key)}>
                  <span className="field-label">{String(label)}</span>
                  <select
                    className="ink-select"
                    onChange={(event) => selectPersona(key as "personaAId" | "personaBId", event.target.value)}
                    value={String(form[key as "personaAId" | "personaBId"] ?? "")}
                  >
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.name} · {persona.era ?? "未知时代"} · {persona.category}
                      </option>
                    ))}
                  </select>
                  <p className="min-h-12 text-xs leading-5 text-[var(--muted)]">
                    {(selected as PersonaView | undefined)?.coreBeliefs ?? "选择身份后会注入核心信念与口吻。"}
                  </p>
                </label>
              ))}
              <div className="md:col-span-2 grid gap-2 md:grid-cols-5">
                {recommendedTopics.map((topic) => (
                  <button
                    className="rounded-md border border-[var(--line)] bg-white/35 p-3 text-left text-xs leading-5 text-[var(--ink-soft)] transition hover:border-[var(--cinnabar)]"
                    key={topic}
                    onClick={() => update("topic", topic)}
                    type="button"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-md border border-[var(--line)] bg-white/35 p-4">
            <label className="space-y-2 block">
              <span className="field-label">议题正文</span>
              <textarea className="ink-textarea min-h-[148px] text-base" onChange={(event) => update("topic", event.target.value)} value={form.topic} />
            </label>
          </section>

          {form.mode !== "persona" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">立场模式</span>
                <select className="ink-select" onChange={(event) => update("stanceMode", event.target.value as DebateSetupInput["stanceMode"])} value={form.stanceMode}>
                  <option value="auto">系统自动拟定甲乙席</option>
                  <option value="custom">手写甲乙两席主张</option>
                </select>
              </label>
              <div className="rounded-md border border-[var(--line)] bg-white/35 p-4 text-sm leading-7 text-[var(--muted)]">
                <Badge tone={modeTone(form.mode as DebateMode)}>{form.mode}</Badge>
                <span className="ml-2">用户可随时暂停、继续、强制裁决或停止。</span>
              </div>
            </div>
          ) : null}

          <section className="rounded-md border border-[var(--line)] bg-white/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="field-label">庭审节奏</span>
              <span className="text-xs font-semibold text-[var(--muted)]">约 {pauseEstimate} 次人工断点</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="最大回合" max={200} min={1} onChange={(value) => update("maxRounds", value)} value={form.maxRounds} />
              <NumberField label="断点频率" max={50} min={1} onChange={(value) => update("pauseEveryRounds", value)} value={form.pauseEveryRounds} />
            </div>
          </section>

          {(form.stanceMode === "custom" || form.mode === "persona") && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">甲方席主张</span>
                <input className="ink-input" onChange={(event) => update("sideA", event.target.value)} value={form.sideA ?? ""} />
              </label>
              <label className="space-y-2">
                <span className="field-label">乙方席主张</span>
                <input className="ink-input" onChange={(event) => update("sideB", event.target.value)} value={form.sideB ?? ""} />
              </label>
            </div>
          )}

          {form.mode === "research" ? (
            <section className="rounded-md border border-[var(--line)] bg-white/35 p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[240px] flex-1 space-y-2">
                  <span className="field-label">搜索关键词</span>
                  <input className="ink-input" onChange={(event) => update("researchQuery", event.target.value)} value={form.researchQuery ?? form.topic} />
                </label>
                <Button onClick={() => void previewSources()} type="button" variant="secondary">
                  <Search className="h-4 w-4" />
                  预览资料包
                </Button>
              </div>
              {sourceMode ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-5 text-[var(--muted)]">
                  <Badge tone={sourceMode === "live" ? "emerald" : "amber"}>
                    {sourceMode === "live" ? "实时来源" : "本地占位"}
                  </Badge>
                  {sourceMode === "live"
                    ? "资料包来自搜索服务返回结果，仍需交叉验证。"
                    : "当前未配置实时搜索凭据；这些链接只用于演示和人工审查入口。"}
                </div>
              ) : null}
              {sourcePreview.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {sourcePreview.slice(0, 4).map((card) => (
                    <div className="rounded-md border border-[var(--line)] bg-[var(--bg-glass)] p-3" key={`${card.sourceName}-${card.title}`}>
                      <div className="text-xs font-semibold text-[var(--cinnabar)]">{card.sourceName}</div>
                      <div className="mt-1 line-clamp-2 text-sm font-bold text-[var(--ink)]">{card.title}</div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--muted)]">{card.summary}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ) : null}

          <details className="advanced-brief rounded-md border border-[var(--line)] bg-white/42">
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Database className="h-4 w-4 text-[var(--lapis)]" />
                高级模型与裁判参数
              </span>
            </summary>
            <div className="space-y-5 border-t border-[var(--line)] p-4">
              <div className="grid gap-4 md:grid-cols-3">
                {seatConfigs.map((seat) => (
                  <div className="rounded-md border border-[var(--line)] bg-white/35 p-3" key={seat.providerKey}>
                    <label className="space-y-2 block">
                      <span className="field-label">{seat.label}</span>
                      <select
                        className="ink-select"
                        onChange={(event) => selectProvider(seat.providerKey, seat.modelKey, seat.role, event.target.value)}
                        value={String(form[seat.providerKey])}
                      >
                        {providerChoices.map((provider) => (
                          <option key={provider.id} value={provider.id}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="mt-3 space-y-2 block">
                      <span className="field-label">模型标识</span>
                      <input
                        className="ink-input"
                        onChange={(event) => update(seat.modelKey, event.target.value)}
                        value={String(form[seat.modelKey] ?? "")}
                      />
                    </label>
                  </div>
                ))}
              </div>

              <label className="space-y-2 block">
                <span className="field-label">判词呈现</span>
                <select className="ink-select" onChange={(event) => update("outputMode", event.target.value as DebateSetupInput["outputMode"])} value={form.outputMode}>
                  <option value="theater">庭审摘录</option>
                  <option value="sentence">逐句拆解</option>
                  <option value="full">原文整段</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <NumberField label="低分线" max={100} min={1} onChange={(value) => update("lowScoreThreshold", value)} value={form.lowScoreThreshold} />
                <NumberField label="连续低分" max={20} min={1} onChange={(value) => update("consecutiveLowLimit", value)} value={form.consecutiveLowLimit} />
                <NumberField label="裁判置信度" max={1} min={0} onChange={(value) => update("judgeConfidence", value)} step={0.05} value={form.judgeConfidence} />
              </div>
            </div>
          </details>

          {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]" role="alert">{error}</p> : null}

          <Button className="w-full" disabled={isPending || blockingIssues.length > 0} onClick={submit} size="lg">
            {isPending ? "正在立卷..." : "立卷并开庭"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Panel>

      <div className="space-y-4 xl:sticky xl:top-8">
        <Panel className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div>
              <Badge tone={readinessTone}>开庭复核</Badge>
              <h2 className="mt-3 font-serif text-xl font-bold text-[var(--ink)]">提交前看这一眼</h2>
            </div>
            {blockingIssues.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-[var(--jade)]" />
            ) : (
              <AlertCircle className="h-5 w-5 text-[var(--rose)]" />
            )}
          </div>

          <dl className="mt-4 grid gap-3 text-sm">
            {[
              ["模式", modeLabel(form.mode)],
              ["辩题字数", `${topicLength} 字`],
              ["轮数规则", `最多 ${form.maxRounds} 轮，约 ${pauseEstimate} 次人工断点`],
              ["裁判规则", `低分线 ${form.lowScoreThreshold}，连续 ${form.consecutiveLowLimit} 次，置信 ${Math.round(form.judgeConfidence * 100)}%`],
              ["呈现方式", outputModeLabel(form.outputMode)],
            ].map(([label, value]) => (
              <div className="flex justify-between gap-4 border-b border-[var(--line)] pb-2 last:border-b-0 last:pb-0" key={label}>
                <dt className="shrink-0 text-xs font-semibold text-[var(--muted)]">{label}</dt>
                <dd className="text-right text-xs leading-5 text-[var(--ink-soft)]">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 space-y-2">
            {blockingIssues.map((issue) => (
              <p className="flex gap-2 rounded-md bg-[var(--rose-soft)] p-2 text-xs leading-5 text-[var(--rose)]" key={issue}>
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {issue}
              </p>
            ))}
            {blockingIssues.length === 0 ? (
              <p className="flex gap-2 rounded-md bg-[var(--jade-soft)] p-2 text-xs leading-5 text-[var(--jade)]">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                基础配置已齐，可以立卷。
              </p>
            ) : null}
            {advisoryNotes.map((note) => (
              <p className="flex gap-2 rounded-md bg-[var(--brass-soft)] p-2 text-xs leading-5 text-[var(--brass)]" key={note}>
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {note}
              </p>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between border-b border-[var(--line)] pb-3">
            <h2 className="font-serif text-lg font-bold text-[var(--ink)]">席位与模型</h2>
            <Badge tone="cyan">{providerChoices.length} 个接入器</Badge>
          </div>
          <div className="space-y-3">
            {seatConfigs.map((seat) => {
              const provider = providerChoicesById.get(String(form[seat.providerKey]));
              return (
                <div className="border-b border-[var(--line)] pb-3 last:border-b-0 last:pb-0" key={seat.providerKey}>
                  <div className="flex items-center justify-between gap-3">
                    <Badge tone={seat.tone}>{seat.shortLabel}</Badge>
                    <span className="text-right text-xs font-semibold text-[var(--muted)]">
                      {provider?.kind === "saved" ? "密钥舱" : "内置"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--ink)]">{provider?.label ?? "未知接入器"}</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    {String(form[seat.modelKey] || "使用服务端默认模型")}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        {[
          ["人格一致性", "裁判会对时代错位、口吻漂移、现代全知视角扣分。"],
          ["联网事实席", "热点模式会先生成共享资料包，双方不得伪造来源。"],
          ["真实接入器", "密钥舱保存的 Provider 实例可分别挂载到甲乙与裁判席。"],
          ["用户最高权限", "断点、轮数上限、暂停、停止和强制裁决仍是最高规则。"],
        ].map(([title, body]) => (
          <Panel className="p-5" key={title}>
            <Badge tone="amber">{title}</Badge>
            <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}
