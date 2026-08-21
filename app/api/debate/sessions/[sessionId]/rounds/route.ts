import { requireCurrentUser } from "@/lib/auth/session";
import { runNextRound } from "@/lib/debate/engine";
import { resolveRoundRequestId } from "@/lib/debate/idempotency";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-round-run", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const requestId = resolveRoundRequestId(request);
    const session = await runNextRound(sessionId, user.id, { requestId });
    return Response.json(
      { session, requestId },
      { headers: { "Idempotency-Key": requestId } },
    );
  } catch (error) {
    return errorResponse(error, "生成下一轮失败。");
  }
}
