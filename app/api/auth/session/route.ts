import { z } from "zod";
import { deleteCurrentAccount, getAuthenticatedUser, getCurrentUser, signOut } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const signInSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function GET(request: Request) {
  const limit = await consumeRateLimit("auth-session-read", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const authenticated = await getAuthenticatedUser();
  const current = authenticated ?? (await getCurrentUser());
  if (!current) {
    return Response.json({
      authenticated: false,
      user: null,
    });
  }
  return Response.json({
    authenticated: Boolean(authenticated),
    user: {
      id: current.id,
      email: current.email,
      name: current.name,
    },
  });
}

export async function POST(request: Request) {
  const limit = await consumeRateLimit("auth-session-create", request, {
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    signInSchema.parse(await request.json());
    return Response.json(
      {
        error: "请使用 magic-link 登录入口。",
        code: "LOGIN_LINK_REQUIRED",
      },
      { status: 410 },
    );
  } catch (error) {
    return errorResponse(error, "登录失败。");
  }
}

export async function DELETE(request: Request) {
  const limit = await consumeRateLimit("auth-session-delete", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const url = new URL(request.url);
    if (url.searchParams.get("account") === "delete") {
      const deleted = await deleteCurrentAccount();
      return Response.json({ deleted });
    }
    await signOut();
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "退出登录失败。");
  }
}
