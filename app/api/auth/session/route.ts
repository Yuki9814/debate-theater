import { z } from "zod";
import { deleteCurrentAccount, getAuthenticatedUser, getCurrentUser, signInWithEmail, signOut } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const signInSchema = z.object({
  email: z.string().trim().email(),
  name: z.string().trim().max(80).optional().or(z.literal("")),
});

export async function GET(request: Request) {
  const limit = consumeRateLimit("auth-session-read", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  const authenticated = await getAuthenticatedUser();
  const current = authenticated ?? (await getCurrentUser());
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
  const limit = consumeRateLimit("auth-session-create", request, {
    limit: 12,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const body = signInSchema.parse(await request.json());
    const user = await signInWithEmail({
      email: body.email,
      name: body.name || undefined,
    });
    return Response.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    return errorResponse(error, "登录失败。");
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("account") === "delete") {
    const deleted = await deleteCurrentAccount();
    return Response.json({ deleted });
  }
  await signOut();
  return Response.json({ ok: true });
}
