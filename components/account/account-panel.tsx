"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { secureFetch } from "@/lib/security/secure-fetch";

export function AccountPanel({
  user,
  authenticated,
}: {
  user: { email: string; name: string | null };
  authenticated: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<"logout" | "delete" | null>(null);
  const [isPending, startTransition] = useTransition();

  function logout() {
    if (confirming !== "logout") {
      setConfirming("logout");
      return;
    }
    startTransition(async () => {
      await secureFetch("/api/auth/session", { method: "DELETE" });
      router.push("/");
      router.refresh();
    });
  }

  function deleteAccount() {
    if (confirming !== "delete") {
      setConfirming("delete");
      return;
    }
    startTransition(async () => {
      await secureFetch("/api/auth/session?account=delete", { method: "DELETE" });
      router.push("/");
      router.refresh();
    });
  }

  async function exportAccount() {
    setError(null);
    const response = await fetch("/api/account/export");
    const payload = await response.text();
    if (!response.ok) {
      setError(payload || "账号数据导出失败。");
      return;
    }
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lunheng-account-export.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage("账号数据导出已开始下载。");
  }

  return (
    <Panel className="mx-auto max-w-3xl p-5 sm:p-7">
      <div className="border-b border-[var(--line)] pb-5">
        <div className="page-kicker">账号边界</div>
        <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">账号与数据</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          当前身份：{authenticated ? user.email : "本地 demo-user"}。正式登录后，卷宗与密钥舱按账号隔离。
        </p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Button onClick={() => void exportAccount()} size="md" variant="secondary">
          <Download className="h-4 w-4" />
          导出数据
        </Button>
        <Button disabled={!authenticated || isPending} onClick={logout} size="md" variant="secondary">
          <LogOut className="h-4 w-4" />
          {confirming === "logout" ? "确认退出" : "退出登录"}
        </Button>
        <Button disabled={!authenticated || isPending} onClick={deleteAccount} size="md" variant="danger">
          <Trash2 className="h-4 w-4" />
          {confirming === "delete" ? "确认删除账号" : "删除账号"}
        </Button>
      </div>
      {confirming ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-[var(--brass-soft)] p-3 text-sm text-[var(--brass)]" role="status">
          <span>{confirming === "delete" ? "删除会清空账号、卷宗、密钥舱与同行者记录。" : "再次点击会清除当前登录会话。"}</span>
          <Button onClick={() => setConfirming(null)} size="sm" variant="ghost">取消</Button>
        </div>
      ) : null}
      {error ? <p className="mt-4 rounded-md bg-[var(--rose-soft)] p-3 text-sm text-[var(--rose)]" role="alert">{error}</p> : null}
      {message ? <p className="mt-4 rounded-md bg-[var(--jade-soft)] p-3 text-sm text-[var(--jade)]" role="status">{message}</p> : null}
    </Panel>
  );
}
