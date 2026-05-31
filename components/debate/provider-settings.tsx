"use client";

import { useState, useTransition } from "react";
import { Database, HardDrive, Info, KeyRound, Plus, ShieldCheck, Trash2, Wifi } from "lucide-react";
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
  const [message, setMessage] = useState<string | null>(null);

  function submit() {
    setError(null);
    setMessage(null);
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
      setMessage("接入器已保存，可在开题页分别挂载到甲乙和裁判席。");
    });
  }

  function patchProvider(providerId: string, body: Partial<ProviderView>) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/providers/${providerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { provider?: ProviderView; error?: string };
      if (!response.ok || !payload.provider) {
        setError(payload.error ?? "更新接入器失败。");
        return;
      }
      setProviders((current) => current.map((provider) => (provider.id === providerId ? payload.provider as ProviderView : provider)));
    });
  }

  function deleteProvider(providerId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/providers/${providerId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "删除接入器失败。");
        return;
      }
      setProviders((current) => current.filter((provider) => provider.id !== providerId));
      setMessage("接入器已删除。");
    });
  }

  function testProvider(providerId: string) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/providers/${providerId}/test`, { method: "POST" });
      const payload = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        setError(payload.error ?? payload.message ?? "测试失败。");
        return;
      }
      setMessage(payload.message ?? "接入器测试通过。");
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Panel className="p-5 sm:p-7">
        <div className="border-b border-[var(--line)] pb-6">
          <div className="page-kicker">
            <KeyRound className="h-4 w-4 text-[var(--cinnabar)]" />
            密钥舱
          </div>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">密钥舱</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
            配置甲乙席与中央裁判可调用的模型接入器。
          </p>
          <div className="mt-4 rounded-md border border-[var(--line)] bg-[var(--jade-soft)]/45 p-3 text-sm leading-6 text-[var(--muted)]">
            公测可先用本地沙箱模拟；真实模型接入适合严肃复盘，也是 Pro 升级的核心价值之一。
          </div>
        </div>

        <div className="mt-7 space-y-5">
          <label className="space-y-2 block">
            <span className="field-label">服务接入器</span>
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
            <span className="field-label">接口基址</span>
            <input
              className="ink-input"
              onChange={(event) => setForm((current) => ({ ...current, baseUrl: event.target.value }))}
              placeholder="https://api.openai.com/v1"
              value={form.baseUrl}
            />
          </label>

          <label className="space-y-2 block">
            <span className="field-label">接口密钥</span>
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
          {message ? <p className="rounded-md bg-[var(--jade-soft)] p-3 text-sm text-[var(--jade)]">{message}</p> : null}

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
                授权密钥提交至服务端后写入本地 SQLite，页面只显示脱敏预览。
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
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button disabled={isPending} onClick={() => testProvider(provider.id)} size="sm" variant="secondary">
                      <Wifi className="h-3.5 w-3.5" />
                      测试
                    </Button>
                    <Button
                      disabled={isPending}
                      onClick={() => patchProvider(provider.id, { enabled: !provider.enabled })}
                      size="sm"
                      variant="ghost"
                    >
                      {provider.enabled ? "停用" : "启用"}
                    </Button>
                    <Button disabled={isPending} onClick={() => deleteProvider(provider.id)} size="sm" variant="danger">
                      <Trash2 className="h-3.5 w-3.5" />
                      删除
                    </Button>
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
