"use client";

import { useState, useTransition } from "react";
import { Database, HardDrive, Info, KeyRound, Plus, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

type ProviderView = {
  id: string;
  providerName: string;
  baseUrl: string | null;
  keyPreview: string | null;
  hasApiKey: boolean;
  defaultModel: string | null;
  enabled: boolean;
};

export function ProviderSettings({ initialProviders }: { initialProviders: ProviderView[] }) {
  const [providers, setProviders] = useState(initialProviders);
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    providerName: "openai",
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    defaultModel: "gpt-4.1-mini",
  });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { provider?: ProviderView; error?: string };

      if (!response.ok || !payload.provider) {
        setError(payload.error ?? "保存供应商失败。");
        return;
      }

      setProviders((current) => [payload.provider as ProviderView, ...current]);
      setForm((current) => ({ ...current, apiKey: "" }));
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Panel className="p-5 sm:p-7">
        <div className="border-b border-[var(--line)] pb-6">
          <div className="page-kicker">
            <KeyRound className="h-4 w-4 text-[var(--cinnabar)]" />
            Provider Vault
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">密钥舱</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            配置辩手与裁判可调用的模型服务商。
          </p>
        </div>

        <div className="mt-7 space-y-5">
          <label className="space-y-2 block">
            <span className="field-label">服务供应商</span>
            <select
              className="ink-select"
              onChange={(event) => setForm((current) => ({ ...current, providerName: event.target.value }))}
              value={form.providerName}
            >
              <option value="openai">OpenAI 官方路由</option>
              <option value="custom-openai">兼容 OpenAI 自定义网关</option>
              <option value="mock">本地沙箱模拟</option>
            </select>
          </label>

          <label className="space-y-2 block">
            <span className="field-label">Base URL</span>
            <input
              className="ink-input"
              onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
              value={form.baseUrl}
            />
          </label>

          <label className="space-y-2 block">
            <span className="field-label">API Key</span>
            <input
              className="ink-input"
              onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
              placeholder="sk-..."
              type="password"
              value={form.apiKey}
            />
          </label>

          <label className="space-y-2 block">
            <span className="field-label">默认模型</span>
            <input
              className="ink-input"
              onChange={(event) => setForm((current) => ({ ...current, defaultModel: event.target.value }))}
              placeholder="gpt-4o-mini"
              value={form.defaultModel}
            />
          </label>

          {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}

          <Button className="w-full" disabled={isPending} onClick={submit} size="lg">
            <Plus className="h-4 w-4" />
            保存接入器
          </Button>
        </div>
      </Panel>

      <div className="space-y-6">
        <Panel className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[var(--line)] bg-white/45">
              <ShieldCheck className="h-5 w-5 text-[var(--jade)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-[var(--muted)]" />
                <h2 className="font-serif text-xl font-bold text-[var(--ink)]">服务端密存</h2>
              </div>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                授权密钥提交至 Next.js 服务端后写入本地 SQLite，页面只显示脱敏预览。
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between border-b border-[var(--line)] pb-4">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-[var(--brass)]" />
              <h2 className="font-serif text-xl font-bold text-[var(--ink)]">接入器</h2>
            </div>
            <Badge tone="neutral">{providers.length}</Badge>
          </div>

          {providers.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--line-strong)] p-10 text-center text-sm text-[var(--muted)]">
              <HardDrive className="mx-auto mb-3 h-8 w-8 text-[var(--muted-light)]" />
              暂无服务商配置。
            </div>
          ) : (
            <div className="divide-y divide-[var(--line)]">
              {providers.map((provider) => (
                <article className="py-4" key={provider.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-[var(--ink)]">{provider.providerName}</h3>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">{provider.baseUrl ?? "默认端点"}</p>
                    </div>
                    <Badge tone={provider.enabled ? "emerald" : "neutral"}>
                      {provider.enabled ? "就绪" : "挂起"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-[var(--muted)] sm:grid-cols-2">
                    <span>模型：{provider.defaultModel ?? "--"}</span>
                    <span>密钥：{provider.keyPreview ?? (provider.hasApiKey ? "••••••••" : "未挂载")}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
