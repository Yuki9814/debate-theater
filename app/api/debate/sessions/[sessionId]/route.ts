import { getSession, updateSessionStatus } from "@/lib/debate/engine";
import { sessionControlSchema } from "@/lib/debate/types";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = consumeRateLimit("debate-session-read", _request, {
    limit: 180,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const session = await getSession(sessionId);

  if (!session) {
    return Response.json({ error: "未找到该辩论场。" }, { status: 404 });
  }

  return Response.json({ session });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = consumeRateLimit("debate-session-update", request, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const body = sessionControlSchema.parse(await request.json());
    const session = await updateSessionStatus({
      sessionId,
      status: body.status,
      winner: body.winner,
      maxRounds: body.maxRounds,
    });

    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "更新辩论场失败。");
  }
}
