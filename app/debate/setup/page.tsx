import { AppShell } from "@/components/layout/app-shell";
import { SetupForm } from "@/components/debate/setup-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function DebateSetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell>
      <Suspense fallback={<div className="rounded-md border border-[var(--line)] bg-[var(--bg-glass)] p-4 text-sm text-[var(--muted)]" role="status">正在载入...</div>}>
        <SetupForm />
      </Suspense>
    </AppShell>
  );
}
