import { notFound } from "next/navigation";
import { DebateRoom } from "@/components/debate/debate-room";
import { AppShell } from "@/components/layout/app-shell";
import { getSession } from "@/lib/debate/engine";

export const dynamic = "force-dynamic";

export default async function DebateSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) notFound();

  return (
    <AppShell>
      <DebateRoom initialSession={session} />
    </AppShell>
  );
}
