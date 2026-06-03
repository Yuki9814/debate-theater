import { requireCurrentUser } from "@/lib/auth/session";
import { sessionInclude } from "@/lib/debate/engine";
import { serializeSession } from "@/lib/debate/serializers";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { providerView } from "@/lib/providers/view";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limit = await consumeRateLimit("account-export", request, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
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
  } catch (error) {
    return errorResponse(error, "导出账号数据失败。", 500);
  }
}
