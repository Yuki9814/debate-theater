import { AppShell } from "@/components/layout/app-shell";
import { CompanionWorkbench } from "@/components/companion/companion-workbench";
import { getCurrentUser } from "@/lib/auth/session";
import { listCompanionSessions } from "@/lib/companion/engine";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CompanionPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const sessions = await listCompanionSessions(user.id);
  return (
    <AppShell>
      <CompanionWorkbench initialSessions={sessions} />
    </AppShell>
  );
}
