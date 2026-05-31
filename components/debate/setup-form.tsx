"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, Database, Network, Scale, Search, Sparkles, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { defaultDebateSetup, providerOptions, type DebateMode, type DebateSetupInput } from "@/lib/debate/types";
import { personaPresets, recommendPersonaTopics } from "@/lib/persona/presets";
import { conversionScenarios } from "@/lib/product/conversion";

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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="field-label">{label}</span>
      <input className="ink-input" max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
    </label>
  );
}

function modeTone(mode: DebateMode) {
  if (mode === "persona") return "rose" as const;
  if (mode === "research") return "cyan" as const;
  return "emerald" as const;
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
      });
    void fetch("/api/personas")
      .then((response) => response.json())
      .then((payload: { personas?: PersonaView[] }) => {
        if (payload.personas?.length) setPersonas(payload.personas);
      });
  }, []);

  const providerChoices = useMemo(
    () => [
      ...providerOptions.map((provider) => ({
        id: provider.id,
        label: provider.name,
        model: provider.id === "mock" ? "mock-theater" : "gpt-4.1-mini",
      })),
      ...providers.map((provider) => ({
        id: provider.id,
        label: `${provider.providerName} · ${provider.defaultModel ?? "默认模型"}`,
        model: provider.defaultModel ?? "",
      })),
    ],
    [providers],
  );

  const personaA = personas.find((persona) => persona.id === form.personaAId);
  const personaB = personas.find((persona) => persona.id === form.personaBId);
  const recommendedTopics =
    personaA && personaB ? recommendPersonaTopics(personaA.name, personaB.name) : [];

  function update<K extends keyof DebateSetupInput>(key: K, value: DebateSetupInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setMode(mode: DebateMode) {
    setForm((current) => ({
      ...current,
      mode,
      stanceMode: mode === "persona" ? "custom" : current.stanceMode,
      sideA: mode === "persona" && personaA ? `${personaA.name}以其思想与经历支持本方主张` : current.sideA,
      sideB: mode === "persona" && personaB ? `${personaB.name}以其思想与经历反驳本方主张` : current.sideB,
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
    const response = await fetch("/api/research/source-cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: form.researchQuery || form.topic }),
    });
    const payload = (await response.json()) as { sourceCards?: SourceCardPreview[]; error?: string };
    if (!response.ok) {
      setError(payload.error ?? "资料包生成失败。");
      return;
    }
    setSourcePreview(payload.sourceCards ?? []);
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
      const response = await fetch("/api/debate/sessions", {
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
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.16fr_0.84fr]">
      <Panel className="docket-paper p-5 sm:p-7">
        <div className="border-b border-[var(--line)] pb-6">
          <div className="page-kicker">
            <Sparkles className="h-4 w-4 text-[var(--cinnabar)]" />
            多模式开庭
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">立卷并开庭</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            自由辩论、人格辩论与热点联网共用同一辩论引擎，甲乙席和裁判席可分别选择密钥舱接入器。
          </p>
        </div>

        <div className="mt-7 space-y-6">
          <section className="grid gap-3 md:grid-cols-3">
            {[
              { id: "free" as const, label: "自由辩论", icon: Scale, body: "自动分正反或手写双方立场。" },
              { id: "persona" as const, label: "人格辩论", icon: Users, body: "选择两位历史人格，按身份风格攻防。" },
              { id: "research" as const, label: "热点联网", icon: Network, body: "先生成共享资料包，再进行事实约束辩论。" },
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
                  <div className="mt-3 font-serif text-lg font-bold text-[var(--ink)]">{item.label}</div>
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{item.body}</p>
                </button>
              );
            })}
          </section>

          <section className="space-y-3">
            <span className="field-label justify-start gap-2">
              <BookOpen className="h-3.5 w-3.5 text-[var(--cinnabar)]" />
              高频开题
            </span>
            <div className="grid gap-2 md:grid-cols-3">
              {PRESET_TOPICS.map((preset, index) => (
                <button
                  className="rounded-md border border-[var(--line)] bg-white/35 p-3 text-left text-sm leading-6 text-[var(--ink-soft)] transition hover:border-[var(--cinnabar)] hover:bg-white/70"
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
                    onChange={(event) => update(key as "personaAId" | "personaBId", event.target.value)}
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

          <label className="space-y-2 block">
            <span className="field-label">议题正文</span>
            <textarea className="ink-textarea min-h-[132px] text-base" onChange={(event) => update("topic", event.target.value)} value={form.topic} />
          </label>

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

          <details className="advanced-brief rounded-md border border-[var(--line)] bg-white/42" open>
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Database className="h-4 w-4 text-[var(--lapis)]" />
                模型席位与裁判参数
              </span>
            </summary>
            <div className="space-y-5 border-t border-[var(--line)] p-4">
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["providerA", "甲方席接入器", "modelA"],
                  ["providerB", "乙方席接入器", "modelB"],
                  ["providerJudge", "裁判席接入器", "modelJudge"],
                ].map(([providerKey, label, modelKey]) => (
                  <div className="rounded-md border border-[var(--line)] bg-white/35 p-3" key={providerKey}>
                    <label className="space-y-2 block">
                      <span className="field-label">{label}</span>
                      <select
                        className="ink-select"
                        onChange={(event) => update(providerKey as "providerA" | "providerB" | "providerJudge", event.target.value)}
                        value={String(form[providerKey as "providerA" | "providerB" | "providerJudge"])}
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
                        onChange={(event) => update(modelKey as "modelA" | "modelB" | "modelJudge", event.target.value)}
                        value={String(form[modelKey as "modelA" | "modelB" | "modelJudge"] ?? "")}
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

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <NumberField label="最大回合" max={200} min={1} onChange={(value) => update("maxRounds", value)} value={form.maxRounds} />
                <NumberField label="断点频率" max={50} min={1} onChange={(value) => update("pauseEveryRounds", value)} value={form.pauseEveryRounds} />
                <NumberField label="低分线" max={100} min={1} onChange={(value) => update("lowScoreThreshold", value)} value={form.lowScoreThreshold} />
                <NumberField label="连续低分" max={20} min={1} onChange={(value) => update("consecutiveLowLimit", value)} value={form.consecutiveLowLimit} />
              </div>
            </div>
          </details>

          {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}

          <Button className="w-full" disabled={isPending} onClick={submit} size="lg">
            {isPending ? "正在立卷..." : "立卷并开庭"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Panel>

      <div className="space-y-4">
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
