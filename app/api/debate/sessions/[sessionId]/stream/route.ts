import { requireCurrentUser } from "@/lib/auth/session";
import { runNextRound, updateSessionStatus } from "@/lib/debate/engine";
import { buildRoundCompletionEvents, sseEvent } from "@/lib/debate/stream-events";
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
    await updateSessionStatus({ sessionId, userId: user.id, status: "running" });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const send = (name: Parameters<typeof sseEvent>[0], data: unknown) => controller.enqueue(encoder.encode(sseEvent(name, data)));
        try {
          send("speaker-a-start", { message: "甲方席开始陈词。" });
          const session = await runNextRound(sessionId, user.id);
          const latestRound = session.rounds.at(-1);
          for (const item of buildRoundCompletionEvents(session, latestRound)) {
            send(item.name, item.data);
          }
        } catch {
          send("error", {
            error: "回合生成失败，请稍后重试。",
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
      },
    });
  } catch (error) {
    return errorResponse(error, "启动流式回合失败。");
  }
}
