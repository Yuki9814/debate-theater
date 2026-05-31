import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回论衡剧场
        </Link>
        <Panel className="p-6 sm:p-8">
          <Badge tone="emerald">公测隐私说明</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">隐私政策</h1>
          <div className="mt-6 space-y-4 text-sm leading-8 text-[var(--muted)]">
            <p>论衡剧场会保存议题、甲乙方发言、裁判评分、Provider 配置预览与额度使用记录，用于恢复卷宗、计算额度和生成复盘。</p>
            <p>真实模型密钥只允许通过服务端保存，并要求配置加密密钥后才能写入。浏览器不会接触平台密钥或用户密钥明文。</p>
            <p>公测阶段不把用户卷宗用于训练模型。接入外部模型时，议题和发言会发送给所选 Provider 以完成生成。</p>
            <p>正式上线前需要接入真实账号体系、数据导出、删除和审计记录；当前 demo-user 仅用于本地或演示环境。</p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-[var(--jade)]">
            <ShieldCheck className="h-4 w-4" />
            最近更新：2026-05-31
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
