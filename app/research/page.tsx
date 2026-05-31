import { AppShell } from "@/components/layout/app-shell";
import { ResearchWorkbench } from "@/components/research/research-workbench";

export const dynamic = "force-dynamic";

export default function ResearchPage() {
  return (
    <AppShell>
      <ResearchWorkbench />
    </AppShell>
  );
}
