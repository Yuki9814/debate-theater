import { z } from "zod";
import { canExposeLoginUrl, sendLoginLinkEmail } from "@/lib/auth/email";
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
    const delivery = await sendLoginLinkEmail({
      to: body.email,
      name: body.name || undefined,
      verificationUrl: loginLink.verificationUrl,
      expiresAt: loginLink.expiresAt,
    });
    const exposeUrl = canExposeLoginUrl();
    return Response.json({
      loginLink: {
        expiresAt: loginLink.expiresAt.toISOString(),
        sent: delivery.sent,
        deliveryProvider: delivery.provider,
        ...(exposeUrl ? { verificationUrl: loginLink.verificationUrl } : {}),
      },
    });
  } catch (error) {
    return errorResponse(error, "创建登录链接失败。");
  }
}
