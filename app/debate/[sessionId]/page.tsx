import { notFound, redirect } from "next/navigation";
import { DebateRoom } from "@/components/debate/debate-room";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { getSession } from "@/lib/debate/engine";

export const dynamic = "force-dynamic";

export default async function DebateSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const session = await getSession(sessionId, user.id);

  if (!session) notFound();

  return (
    <AppShell>
      <DebateRoom initialSession={session} />
    </AppShell>
  );
}
