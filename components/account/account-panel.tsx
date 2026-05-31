"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export function AccountPanel({
  user,
  authenticated,
}: {
  user: { email: string; name: string | null };
  authenticated: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      await fetch("/api/auth/session", { method: "DELETE" });
      router.push("/");
      router.refresh();
    });
  }

  function deleteAccount() {
    startTransition(async () => {
      await fetch("/api/auth/session?account=delete", { method: "DELETE" });
      router.push("/");
      router.refresh();
    });
  }

  async function exportAccount() {
    const response = await fetch("/api/account/export");
    const payload = await response.text();
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
          退出登录
        </Button>
        <Button disabled={!authenticated || isPending} onClick={deleteAccount} size="md" variant="danger">
          <Trash2 className="h-4 w-4" />
          删除账号
        </Button>
      </div>
      {message ? <p className="mt-4 rounded-md bg-[var(--jade-soft)] p-3 text-sm text-[var(--jade)]">{message}</p> : null}
    </Panel>
  );
}
