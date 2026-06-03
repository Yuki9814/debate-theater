import { AppShell } from "@/components/layout/app-shell";
import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="rounded-md border border-[var(--line)] bg-[var(--bg-glass)] p-4 text-sm text-[var(--muted)]" role="status">正在载入...</div>}>
        <LoginForm />
      </Suspense>
    </AppShell>
  );
}
