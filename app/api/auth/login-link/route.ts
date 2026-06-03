import { z } from "zod";
import { createLoginLink } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { canonicalOrigin, requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const loginLinkSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("auth-login-link", request, {
    limit: 8,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const body = loginLinkSchema.parse(await request.json());
    const loginLink = await createLoginLink({
      email: body.email,
      name: body.name || undefined,
      origin: canonicalOrigin(request),
    });
    return Response.json({
      loginLink: {
        expiresAt: loginLink.expiresAt.toISOString(),
        verificationUrl: loginLink.verificationUrl,
      },
    });
  } catch (error) {
    return errorResponse(error, "创建登录链接失败。");
  }
}
