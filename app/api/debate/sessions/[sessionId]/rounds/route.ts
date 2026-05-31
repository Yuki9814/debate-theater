import { runNextRound, updateSessionStatus } from "@/lib/debate/engine";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = consumeRateLimit("debate-round-run", _request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    await updateSessionStatus({ sessionId, status: "running" });
    const session = await runNextRound(sessionId);
    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "生成下一轮失败。");
  }
}
