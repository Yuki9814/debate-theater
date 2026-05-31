import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function TermsPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link className={buttonVariants({ variant: "ghost", size: "sm" })} href="/">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回论衡剧场
        </Link>
        <Panel className="p-6 sm:p-8">
          <Badge tone="amber">公测条款</Badge>
          <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)]">服务条款</h1>
          <div className="mt-6 space-y-4 text-sm leading-8 text-[var(--muted)]">
            <p>论衡剧场提供 AI 辩论、裁判评分、复盘和导出能力。生成内容仅用于辅助思考，不构成法律、医疗、金融或其他专业意见。</p>
            <p>用户需要对输入议题和使用结果负责，不得提交违法、有害、侵犯隐私或侵犯知识产权的内容。</p>
            <p>免费版提供本地 mock 与有限额度；Pro/Studio 能力以实际订阅、额度和 Provider 配置为准。</p>
            <p>公测阶段功能可能调整。涉及支付、团队空间、真实认证和生产监控的能力，以上线检查通过为准。</p>
          </div>
          <div className="mt-6 flex items-center gap-2 text-xs text-[var(--brass)]">
            <Scale className="h-4 w-4" />
            最近更新：2026-05-31
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
