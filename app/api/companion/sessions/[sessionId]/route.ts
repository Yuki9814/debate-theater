import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { advanceCompanionSession, rollbackCompanionSession } from "@/lib/companion/engine";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

const actionSchema = z.object({
  action: z.enum(["advance", "rollback", "stop"]),
});

export async function PATCH(request: Request, context: RouteContext) {
  const limit = consumeRateLimit("companion-session-action", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const { sessionId } = await context.params;
    const user = await getCurrentUser();
    const body = actionSchema.parse(await request.json());
    if (body.action === "advance") {
      return Response.json({ session: await advanceCompanionSession(user.id, sessionId) });
    }
    if (body.action === "rollback") {
      return Response.json({ session: await rollbackCompanionSession(user.id, sessionId) });
    }
    const session = await prisma.companionSession.update({
      where: { id: sessionId, userId: user.id },
      data: { status: "stopped" },
    });
    return Response.json({ session });
  } catch (error) {
    return errorResponse(error, "更新同行者世界线失败。");
  }
}
