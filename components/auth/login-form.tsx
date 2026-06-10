"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Link as LinkIcon, LogIn, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { secureFetch } from "@/lib/security/secure-fetch";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({ email: "", name: "" });
  const [verificationUrl, setVerificationUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    setMessage(null);
    setVerificationUrl(null);
    startTransition(async () => {
      try {
        const response = await secureFetch("/api/auth/login-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const payload = (await response.json()) as {
          loginLink?: { verificationUrl?: string; expiresAt?: string };
          error?: string;
        };
        if (!response.ok) {
          setError(payload.error ?? "登录链接创建失败。");
          return;
        }
        setVerificationUrl(payload.loginLink?.verificationUrl ?? null);
        setMessage(
          payload.loginLink?.verificationUrl
            ? "本地登录链接已生成。"
            : `登录邮件已发送，链接有效期至 ${payload.loginLink?.expiresAt?.slice(11, 16) ?? "15 分钟内"}。`,
        );
      } catch (loginError) {
        setError(loginError instanceof Error ? loginError.message : "登录链接创建失败。");
      }
    });
  }

  function verifyToken(token: string) {
    setError(null);
    startTransition(async () => {
      try {
        const response = await secureFetch("/api/auth/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setError(payload.error ?? "登录链接验证失败。");
          return;
        }
        router.push("/dashboard");
        router.refresh();
      } catch (verifyError) {
        setError(verifyError instanceof Error ? verifyError.message : "登录链接验证失败。");
      }
    });
  }

  const token = searchParams.get("token");

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
        {token ? (
          <div className="rounded-md border border-[var(--jade)]/35 bg-[var(--jade-soft)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--jade)]">
              <CheckCircle2 className="h-4 w-4" />
              检测到登录链接
            </div>
            <Button className="mt-4 w-full" disabled={isPending} onClick={() => verifyToken(token)} size="lg">
              <LogIn className="h-4 w-4" />
              验证并进入
            </Button>
          </div>
        ) : null}
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
        {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]" role="alert">{error}</p> : null}
        {message ? <p className="rounded-md bg-[var(--jade-soft)] p-3 text-sm text-[var(--jade)]" role="status">{message}</p> : null}
        {verificationUrl ? (
          <a
            className="flex items-center gap-2 rounded-md border border-[var(--jade)]/35 bg-[var(--jade-soft)] p-3 text-sm font-semibold text-[var(--jade)]"
            href={verificationUrl}
          >
            <LinkIcon className="h-4 w-4" />
            打开刚生成的登录链接
          </a>
        ) : null}
        <Button className="w-full" disabled={isPending || !form.email.trim()} onClick={submit} size="lg">
          <LogIn className="h-4 w-4" />
          {isPending ? "正在处理..." : "生成登录链接"}
        </Button>
        <Badge tone="neutral">ChatGPT 生态入口后续走 ChatGPT App / MCP，不伪装成 OpenAI SSO。</Badge>
      </div>
    </Panel>
  );
}
