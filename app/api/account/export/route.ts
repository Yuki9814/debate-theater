import { getCurrentUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/debate/engine";
import { serializeSession } from "@/lib/debate/serializers";
import { prisma } from "@/lib/db/prisma";
import { providerView } from "@/lib/providers/view";

export async function GET() {
  const user = await getCurrentUser();
  const [sessions, providers, companions] = await Promise.all([
    prisma.debateSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: sessionInclude,
    }),
    prisma.apiProvider.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.companionSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return Response.json({
    exportedAt: new Date().toISOString(),
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    providers: providers.map(providerView),
    sessions: sessions.map(serializeSession),
    companions,
  });
}
