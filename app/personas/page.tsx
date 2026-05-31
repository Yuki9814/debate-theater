import { AppShell } from "@/components/layout/app-shell";
import { PersonaLibrary } from "@/components/persona/persona-library";
import { personaPresets } from "@/lib/persona/presets";

export const dynamic = "force-dynamic";

export default function PersonasPage() {
  return (
    <AppShell>
      <PersonaLibrary personas={personaPresets} />
    </AppShell>
  );
}
