import { requireCurrentUser } from "@/lib/auth/session";
import { createCompanionSession, listCompanionSessions } from "@/lib/companion/engine";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limit = await consumeRateLimit("companion-sessions-list", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
    const sessions = await listCompanionSessions(user.id);
    return Response.json({ sessions });
  } catch (error) {
    return errorResponse(error, "读取同行者世界线失败。", 500);
  }
}

export async function POST(request: Request) {
  const limit = await consumeRateLimit("companion-sessions-create", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const session = await createCompanionSession(user.id, await request.json());
    return Response.json({ session }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "创建同行者世界线失败。");
  }
}
