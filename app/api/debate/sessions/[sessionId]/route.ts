import { requireCurrentUser } from "@/lib/auth/session";
import { getSession, updateSessionStatus } from "@/lib/debate/engine";
import { sessionControlSchema } from "@/lib/debate/types";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-session-read", _request, {
    limit: 180,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
    const session = await getSession(sessionId, user.id);

    if (!session) {
      return Response.json({ error: "未找到该辩论场。" }, { status: 404 });
    }

    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "读取辩论场失败。", 500);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-session-update", request, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const body = sessionControlSchema.parse(await request.json());
    const user = await requireCurrentUser();
    const session = await updateSessionStatus({
      sessionId,
      userId: user.id,
      status: body.status,
      winner: body.winner,
      maxRounds: body.maxRounds,
    });

    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "更新辩论场失败。");
  }
}
