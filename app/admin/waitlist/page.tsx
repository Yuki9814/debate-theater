import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Inbox, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { isAdminEmail } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { summarizeWaitlistLeads } from "@/lib/product/waitlist";
import { formatDateTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WaitlistAdminPage() {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/login");

  if (!isAdminEmail(user.email)) {
    return (
      <AppShell>
        <Panel className="mx-auto max-w-2xl p-7 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-[var(--brass)]" />
          <h1 className="mt-4 font-serif text-3xl font-black text-[var(--ink)]">需要管理员权限</h1>
          <p className="mt-3 text-sm leading-7 text-[var(--muted)]">等待名单包含联系邮箱，仅管理员可查看。</p>
        </Panel>
      </AppShell>
    );
  }

  const leads = await prisma.waitlistLead.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
  });
  const modules = summarizeWaitlistLeads(leads);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-7">
          <div>
            <div className="page-kicker">
              <Inbox className="h-4 w-4 text-[var(--cinnabar)]" />
              Admin
            </div>
            <h1 className="mt-4 font-serif text-4xl font-black text-[var(--ink)] sm:text-5xl">等待名单运营</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">
              按模块查看真实需求，决定人格、热点资料与同行者的开放顺序。
            </p>
          </div>
          <Link className={buttonVariants({ variant: "secondary", size: "md" })} href="/api/waitlist?format=csv">
            <Download className="h-4 w-4" />
            CSV
          </Link>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          {modules.map((module) => (
            <Panel className="p-5" key={module.moduleId}>
              <div className="flex items-center justify-between gap-3">
                <Badge tone="cyan">{module.moduleId}</Badge>
                <span className="font-serif text-3xl font-black text-[var(--ink)]">{module.count}</span>
              </div>
              <h2 className="mt-4 font-serif text-xl font-bold text-[var(--ink)]">{module.title}</h2>
              <div className="mt-4 space-y-3">
                {module.latestUseCases.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">暂无意向。</p>
                ) : (
                  module.latestUseCases.map((lead) => (
                    <article className="rounded-md border border-[var(--line)] bg-white/35 p-3" key={`${module.moduleId}-${lead.email}-${lead.createdAt}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
                        <span>{lead.email}</span>
                        <span>{formatDateTime(lead.createdAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-[var(--ink-soft)]">{lead.useCase}</p>
                    </article>
                  ))
                )}
              </div>
            </Panel>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
