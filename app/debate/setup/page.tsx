import { AppShell } from "@/components/layout/app-shell";
import { SetupForm } from "@/components/debate/setup-form";

export const dynamic = "force-dynamic";

export default function DebateSetupPage() {
  return (
    <AppShell>
      <SetupForm />
    </AppShell>
  );
}
