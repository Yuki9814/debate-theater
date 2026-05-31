import { getCurrentUser } from "@/lib/auth/session";
import { runNextRound, updateSessionStatus } from "@/lib/debate/engine";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = consumeRateLimit("debate-round-stream", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await getCurrentUser();
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
        } catch (streamError) {
          send("error", {
            error: streamError instanceof Error ? streamError.message : "流式生成失败。",
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
