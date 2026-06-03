import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { getBillingEntitlement } from "@/lib/billing/service";
import { sessionInclude } from "@/lib/debate/engine";
import { exportSessionAsMarkdown } from "@/lib/debate/recap";
import { serializeSession } from "@/lib/debate/serializers";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const exportSchema = z.object({
  format: z.enum(["markdown", "json"]).default("markdown"),
});

function safeFileName(topic: string, format: "markdown" | "json") {
  const base = topic
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${base || "debate-session"}.${format === "markdown" ? "md" : "json"}`;
}

export async function POST(request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const limit = await consumeRateLimit("debate-session-export", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const body = exportSchema.parse(await request.json());
    const session = await prisma.debateSession.findUnique({
      where: { id: sessionId },
      include: sessionInclude,
    });

    if (!session || session.userId !== user.id) {
      throw new AppError("未找到可导出的卷宗。", 404, "SESSION_NOT_FOUND");
    }

    const serialized = serializeSession(session);
    const entitlement = await getBillingEntitlement(user.id);
    const canDownload = entitlement.plan.id !== "free";
    const fullContent =
      body.format === "json"
        ? JSON.stringify(serialized, null, 2)
        : exportSessionAsMarkdown(serialized);
    const content = canDownload ? fullContent : fullContent.slice(0, 1800);

    return Response.json({
      export: {
        format: body.format,
        filename: safeFileName(serialized.topic, body.format),
        content,
        canDownload,
        previewOnly: !canDownload,
        upgradeRequired: !canDownload,
        planId: entitlement.plan.id,
      },
    });
  } catch (error) {
    return errorResponse(error, "导出卷宗失败。");
  }
}
