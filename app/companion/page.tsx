import { AppShell } from "@/components/layout/app-shell";
import { CompanionWorkbench } from "@/components/companion/companion-workbench";
import { getCurrentUser } from "@/lib/auth/session";
import { listCompanionSessions } from "@/lib/companion/engine";

export const dynamic = "force-dynamic";

export default async function CompanionPage() {
  const user = await getCurrentUser();
  const sessions = await listCompanionSessions(user.id);
  return (
    <AppShell>
      <CompanionWorkbench initialSessions={sessions} />
    </AppShell>
  );
}
