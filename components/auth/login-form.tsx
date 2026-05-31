"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function LoginForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ email: "", name: "" });
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "登录失败。");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <Panel className="mx-auto max-w-xl p-5 sm:p-7">
      <div className="border-b border-[var(--line)] pb-5">
        <div className="page-kicker">
          <ShieldCheck className="h-4 w-4 text-[var(--cinnabar)]" />
          账号隔离
        </div>
        <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">进入论衡剧场</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          本地版本使用邮箱会话登录，卷宗、密钥舱、人格与世界线都会绑定到该账号。
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <label className="space-y-2 block">
          <span className="field-label">邮箱</span>
          <input
            className="ink-input"
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            placeholder="name@example.com"
            type="email"
            value={form.email}
          />
        </label>
        <label className="space-y-2 block">
          <span className="field-label">称呼</span>
          <input
            className="ink-input"
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="卷宗署名，可留空"
            value={form.name}
          />
        </label>
        {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}
        <Button className="w-full" disabled={isPending || !form.email.trim()} onClick={submit} size="lg">
          <LogIn className="h-4 w-4" />
          {isPending ? "正在登录..." : "登录并进入"}
        </Button>
        <Badge tone="neutral">ChatGPT 生态入口后续走 ChatGPT App / MCP，不伪装成 OpenAI SSO。</Badge>
      </div>
    </Panel>
  );
}
