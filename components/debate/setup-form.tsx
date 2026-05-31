"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronDown, Gauge, Scale, ShieldCheck, SlidersHorizontal, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { defaultDebateSetup, providerOptions, type DebateSetupInput } from "@/lib/debate/types";
import { conversionScenarios } from "@/lib/product/conversion";

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

type PresetTopic = (typeof PRESET_TOPICS)[number];

function NumberField({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  suffix?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="field-label">
        {label}
        {suffix ? <span className="font-normal">{suffix}</span> : null}
      </span>
      <input
        className="ink-input"
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function ProviderSelect({
  label,
  value,
  model,
  onProviderChange,
  onModelChange,
}: {
  label: string;
  value: DebateSetupInput["providerA"];
  model: string;
  onProviderChange: (value: DebateSetupInput["providerA"]) => void;
  onModelChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-3 rounded-md border border-[var(--line)] bg-white/35 p-4 sm:grid-cols-[1fr_1fr]">
      <label className="space-y-2">
        <span className="field-label">{label}</span>
        <select
          className="ink-select"
          onChange={(event) => onProviderChange(event.target.value as DebateSetupInput["providerA"])}
          value={value}
        >
          {providerOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </label>
      <label className="space-y-2">
        <span className="field-label">模型标识</span>
        <input
          className="ink-input"
          onChange={(event) => onModelChange(event.target.value)}
          placeholder={value === "mock" ? "mock-theater" : "gpt-4o-mini"}
          value={model}
        />
      </label>
    </div>
  );
}

export function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const scenarioId = searchParams.get("scenario");
  const scenario = conversionScenarios.find((item) => item.id === scenarioId);
  const queryTopic = searchParams.get("topic")?.trim();
  const [form, setForm] = useState<DebateSetupInput>({
    ...defaultDebateSetup,
    topic: scenario?.topic ?? queryTopic ?? "人工智能未来是否应该被赋予法律主体地位与道德权利义务？",
    sideA: scenario?.sideA,
    sideB: scenario?.sideB,
    mode: scenario ? "custom" : "auto",
    modelA: "mock-theater-a",
    modelB: "mock-theater-b",
    modelJudge: "mock-judge",
    outputMode: "theater",
  });
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof DebateSetupInput>(key: K, value: DebateSetupInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(preset: PresetTopic) {
    setForm((current) => ({
      ...current,
      topic: preset.topic,
      sideA: preset.sideA,
      sideB: preset.sideB,
      mode: "custom",
    }));
  }

  async function submit() {
    setError(null);
    const sideA = form.sideA?.trim() ?? "";
    const sideB = form.sideB?.trim() ?? "";
    if (form.mode === "custom" && (!sideA || !sideB)) {
      setError("手动立场需要同时写明甲方与乙方主张，方可立卷。");
      return;
    }

    const preparedForm: DebateSetupInput = {
      ...form,
      topic: form.topic.trim(),
      sideA: sideA || undefined,
      sideB: sideB || undefined,
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

  const customStanceMissing =
    form.mode === "custom" && (!(form.sideA ?? "").trim() || !(form.sideB ?? "").trim());

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Panel className="docket-paper p-5 sm:p-7">
        <div className="border-b border-[var(--line)] pb-6">
          <div className="page-kicker">
            <SlidersHorizontal className="h-4 w-4 text-[var(--cinnabar)]" />
            快速开庭
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">三分钟开一场辩论</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            先写议题，默认由系统自动拟定甲乙两席。需要精细控制时，再展开高级设置。
          </p>
        </div>

        <div className="mt-7 space-y-6">
          <section className="space-y-3">
            <span className="field-label justify-start gap-2">
              <Sparkles className="h-3.5 w-3.5 text-[var(--cinnabar)]" />
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
                  <span className="mr-2 font-serif text-base font-bold text-[var(--cinnabar)]">
                    {index + 1}
                  </span>
                  {preset.topic}
                </button>
              ))}
            </div>
          </section>

          <label className="space-y-2 block">
            <span className="field-label">议题正文</span>
            <textarea
              className="ink-textarea min-h-[132px] text-base"
              onChange={(event) => update("topic", event.target.value)}
              placeholder="写下本次评议的核心议题..."
              value={form.topic}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">立场模式</span>
              <select
                className="ink-select"
                onChange={(event) => update("mode", event.target.value as DebateSetupInput["mode"])}
                value={form.mode}
              >
                <option value="auto">快速：系统自动拟定甲乙席</option>
                <option value="custom">进阶：手写甲乙两席主张</option>
              </select>
            </label>
            <div className="rounded-md border border-[var(--line)] bg-[var(--jade-soft)]/40 p-4 text-sm leading-7 text-[var(--muted)]">
              免费公测默认使用 mock 模式，可先验证流程；真实模型、导出与长复盘在升级路径中解锁。
            </div>
          </div>

          {form.mode === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">甲方席主张</span>
                <input
                  className={customStanceMissing && !(form.sideA ?? "").trim() ? "ink-input border-[var(--rose)]" : "ink-input"}
                  onChange={(event) => update("sideA", event.target.value)}
                  placeholder="请输入甲方观点..."
                  value={form.sideA ?? ""}
                />
              </label>
              <label className="space-y-2">
                <span className="field-label">乙方席主张</span>
                <input
                  className={customStanceMissing && !(form.sideB ?? "").trim() ? "ink-input border-[var(--rose)]" : "ink-input"}
                  onChange={(event) => update("sideB", event.target.value)}
                  placeholder="请输入乙方观点..."
                  value={form.sideB ?? ""}
                />
              </label>
            </div>
          )}

          <details className="advanced-brief rounded-md border border-[var(--line)] bg-white/42">
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-4">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Scale className="h-4 w-4 text-[var(--lapis)]" />
                高级裁判参数
              </span>
              <span className="hidden shrink-0 items-center gap-2 text-xs text-[var(--muted)] sm:flex">
                回合、断点、模型与密钥舱
                <ChevronDown className="h-4 w-4" />
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)] sm:hidden" />
            </summary>
            <div className="space-y-6 border-t border-[var(--line)] p-4">
              <label className="space-y-2 block">
                <span className="field-label">判词呈现</span>
                <select
                  className="ink-select"
                  onChange={(event) =>
                    update("outputMode", event.target.value as DebateSetupInput["outputMode"])
                  }
                  value={form.outputMode}
                >
                  <option value="theater">庭审摘录</option>
                  <option value="sentence">逐句拆解</option>
                  <option value="full">原文整段</option>
                </select>
              </label>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <NumberField
                  label="最大回合"
                  max={200}
                  min={1}
                  onChange={(value) => update("maxRounds", value)}
                  suffix="1-200"
                  value={form.maxRounds}
                />
                <NumberField
                  label="断点频率"
                  max={50}
                  min={1}
                  onChange={(value) => update("pauseEveryRounds", value)}
                  suffix="每 N 轮"
                  value={form.pauseEveryRounds}
                />
                <NumberField
                  label="低分线"
                  max={100}
                  min={1}
                  onChange={(value) => update("lowScoreThreshold", value)}
                  suffix="1-100"
                  value={form.lowScoreThreshold}
                />
                <NumberField
                  label="连续低分上限"
                  max={20}
                  min={1}
                  onChange={(value) => update("consecutiveLowLimit", value)}
                  suffix="1-20"
                  value={form.consecutiveLowLimit}
                />
              </div>

              <label className="space-y-3 block">
                <span className="field-label">
                  裁判置信阈值
                  <span>{Math.round(form.judgeConfidence * 100)}%</span>
                </span>
                <input
                  className="w-full accent-[var(--cinnabar)]"
                  max="1"
                  min="0.3"
                  onChange={(event) => update("judgeConfidence", Number(event.target.value))}
                  step="0.05"
                  type="range"
                  value={form.judgeConfidence}
                />
              </label>

              <section className="space-y-3">
                <span className="field-label justify-start gap-2">
                  <Scale className="h-3.5 w-3.5 text-[var(--lapis)]" />
                  密钥舱与算力席次
                </span>
                <ProviderSelect
                  label="甲方席代理"
                  model={form.modelA ?? ""}
                  onModelChange={(value) => update("modelA", value)}
                  onProviderChange={(value) => update("providerA", value)}
                  value={form.providerA}
                />
                <ProviderSelect
                  label="乙方席代理"
                  model={form.modelB ?? ""}
                  onModelChange={(value) => update("modelB", value)}
                  onProviderChange={(value) => update("providerB", value)}
                  value={form.providerB}
                />
                <ProviderSelect
                  label="中央裁判席"
                  model={form.modelJudge ?? ""}
                  onModelChange={(value) => update("modelJudge", value)}
                  onProviderChange={(value) => update("providerJudge", value)}
                  value={form.providerJudge}
                />
              </section>
            </div>
          </details>

          {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}

          <Button className="w-full" disabled={isPending} onClick={submit} size="lg">
            {isPending ? "正在立卷..." : "立卷并开庭"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Panel>

      <div className="hidden space-y-4 xl:block">
        {[
          {
            title: "断点复核",
            body: "最高轮数、低分线与连续低分上限共同构成庭审护栏。",
            icon: Gauge,
            tone: "cyan" as const,
          },
          {
            title: "中文判词",
            body: "两席围绕主张连续陈词，中央裁判逐轮留下判词与分牌。",
            icon: Sparkles,
            tone: "rose" as const,
          },
          {
            title: "密钥舱",
            body: "真实服务商密钥封存在服务端，浏览器只接触本地路由。",
            icon: ShieldCheck,
            tone: "emerald" as const,
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Panel className="p-5 shadow-none" key={item.title}>
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white/45">
                  <Icon className="h-5 w-5 text-[var(--cinnabar)]" />
                </div>
                <div>
                  <Badge tone={item.tone}>{item.title}</Badge>
                  <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{item.body}</p>
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
