import { requireCurrentUser } from "@/lib/auth/session";
import { runNextRound } from "@/lib/debate/engine";
import { resolveRoundRequestId } from "@/lib/debate/idempotency";
import { buildRoundCompletionEvents, sseEvent } from "@/lib/debate/stream-events";
import { AppError } from "@/lib/errors";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-round-stream", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const requestId = resolveRoundRequestId(request);

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (name: Parameters<typeof sseEvent>[0], data: unknown) => controller.enqueue(encoder.encode(sseEvent(name, data)));
        try {
          const session = await runNextRound(sessionId, user.id, {
            requestId,
            onProgress(event) {
              send(event.name, event.data);
            },
          });
          const latestRound = session.rounds.at(-1);
          for (const item of buildRoundCompletionEvents(session, latestRound)) {
            if (["usage-delta", "session", "done"].includes(item.name)) {
              send(item.name, item.data);
            }
          }
        } catch (error) {
          send("error", {
            error: error instanceof AppError ? error.message : "回合生成失败，请稍后重试。",
            code: error instanceof AppError ? error.code : "ROUND_EXECUTION_FAILED",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Idempotency-Key": requestId,
      },
    });
  } catch (error) {
    return errorResponse(error, "启动流式回合失败。");
  }
}
