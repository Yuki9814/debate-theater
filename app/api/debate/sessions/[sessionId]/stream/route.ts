import { requireCurrentUser } from "@/lib/auth/session";
import { runNextRound, updateSessionStatus } from "@/lib/debate/engine";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

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
        const send = (name: string, data: unknown) => controller.enqueue(encoder.encode(event(name, data)));
        try {
          send("stage", { stage: "speaker-a", message: "甲方席开始陈词。" });
          send("stage", { stage: "speaker-b", message: "乙方席准备反驳。" });
          send("stage", { stage: "judge", message: "中央裁判席正在评分。" });
          const session = await runNextRound(sessionId, user.id);
          send("session", { session });
          send("done", { ok: true });
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
