import { requireCurrentUser } from "@/lib/auth/session";
import { createDebateSession, sessionInclude } from "@/lib/debate/engine";
import { serializeSession } from "@/lib/debate/serializers";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limit = await consumeRateLimit("debate-sessions-list", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
    const sessions = await prisma.debateSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: sessionInclude,
    });

    return Response.json({
      sessions: sessions.map(serializeSession),
    });
  } catch (error) {
    return errorResponse(error, "读取辩论历史失败。", 500);
  }
}

export async function POST(request: Request) {
  const limit = await consumeRateLimit("debate-sessions-create", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const body = await request.json();
    const user = await requireCurrentUser();
    const session = await createDebateSession(body, user.id);
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "创建辩论场失败。");
  }
}
