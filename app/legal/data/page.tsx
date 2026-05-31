import Link from "next/link";
import { ArrowLeft, Download, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function DataRightsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回论衡剧场
        </Link>
        <Panel className="p-6 sm:p-8">
          <Badge tone="cyan">数据权利</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">导出与删除</h1>
          <div className="mt-6 space-y-4 text-sm leading-8 text-[var(--muted)]">
            <p>单场卷宗支持 Markdown 与 JSON 预览导出。Pro 及以上计划可下载完整卷宗，用于文档、会议和研究记录。</p>
            <p>正式账号体系上线后，每个账号需要能够删除自己的卷宗、Provider 配置与等待名单记录。</p>
            <p>当前本地演示环境使用 demo-user，数据保存在本地 SQLite；生产环境不得继续使用 demo-user 作为真实账号边界。</p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-[var(--line)] bg-white/35 p-4 text-sm text-[var(--muted)]">
              <Download className="mb-3 h-5 w-5 text-[var(--cinnabar)]" />
              导出：每场卷宗进入辩论房间后使用复盘区导出按钮。
            </div>
            <div className="rounded-md border border-[var(--line)] bg-white/35 p-4 text-sm text-[var(--muted)]">
              <Trash2 className="mb-3 h-5 w-5 text-[var(--rose)]" />
              删除：生产账号体系接入后开放账号级删除入口。
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
