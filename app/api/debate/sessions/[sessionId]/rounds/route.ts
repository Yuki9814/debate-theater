import { requireCurrentUser } from "@/lib/auth/session";
import { runNextRound, updateSessionStatus } from "@/lib/debate/engine";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-round-run", _request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(_request);
    const user = await requireCurrentUser();
    await updateSessionStatus({ sessionId, userId: user.id, status: "running" });
    const session = await runNextRound(sessionId, user.id);
    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "生成下一轮失败。");
  }
}
