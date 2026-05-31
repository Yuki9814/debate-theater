"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function WaitlistForm({ moduleId }: { moduleId: string }) {
  const [email, setEmail] = useState("");
  const [useCase, setUseCase] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, email, useCase }),
      });
      const payload = (await response.json()) as { waitlist?: { id: string }; error?: string };

      if (!response.ok || !payload.waitlist) {
        setError(payload.error ?? "提交失败，请稍后再试。");
        return;
      }

      setMessage("已加入等待名单。模块开放时会优先通知。");
      setEmail("");
      setUseCase("");
    });
  }

  return (
    <div className="space-y-4">
      <label className="space-y-2 block">
        <span className="field-label">联系邮箱</span>
        <input
          className="ink-input"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@example.com"
          type="email"
          value={email}
        />
      </label>
      <label className="space-y-2 block">
        <span className="field-label">想解决的场景</span>
        <textarea
          className="ink-textarea"
          onChange={(event) => setUseCase(event.target.value)}
          placeholder="例如：想让历史人物围绕小说设定做价值观冲突..."
          value={useCase}
        />
      </label>

      {error ? <p className="rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]">{error}</p> : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-md bg-[var(--jade-soft)] p-3 text-sm text-[var(--jade)]">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </p>
      ) : null}

      <Button className="w-full" disabled={isPending} onClick={submit} size="lg">
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        加入等待名单
      </Button>
    </div>
  );
}
