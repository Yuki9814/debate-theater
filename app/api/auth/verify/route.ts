import { z } from "zod";
import { verifyLoginToken } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const verifySchema = z.object({
  token: z.string().trim().min(20).max(200),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("auth-verify", request, {
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const body = verifySchema.parse(await request.json());
    const user = await verifyLoginToken(body.token);
    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return errorResponse(error, "验证登录链接失败。");
  }
}
