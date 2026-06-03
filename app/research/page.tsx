import { AppShell } from "@/components/layout/app-shell";
import { ResearchWorkbench } from "@/components/research/research-workbench";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ResearchPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return (
    <AppShell>
      <ResearchWorkbench />
    </AppShell>
  );
}
