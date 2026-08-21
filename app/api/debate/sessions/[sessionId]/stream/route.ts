import { requireCurrentUser } from "@/lib/auth/session";
import { getSession, runNextRoundExecution } from "@/lib/debate/engine";
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
          const result = await runNextRoundExecution(sessionId, user.id, {
            requestId,
            onProgress(event) {
              send(event.name, event.data);
            },
          });
          const latestRound = result.roundId
            ? result.session.rounds.find((round) => round.id === result.roundId)
            : result.roundNumber
              ? result.session.rounds.find((round) => round.roundNumber === result.roundNumber)
              : undefined;
          for (const item of buildRoundCompletionEvents(result.session, latestRound)) {
            if (["usage-delta", "session", "done"].includes(item.name)) {
              send(item.name, item.data);
            }
          }
        } catch (error) {
          // The worker pauses failed rounds when it still owns the lease. Send
          // the newest session before event:error so clients can recover the
          // durable state even though the stream has already been established.
          try {
            const latest = await getSession(sessionId, user.id);
            if (latest) send("session", { session: latest });
          } catch {
            // Preserve the original execution error if the recovery read fails.
          }
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
