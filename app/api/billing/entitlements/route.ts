import { getBillingEntitlement } from "@/lib/billing/service";
import { requireCurrentUser } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

export async function GET(request: Request) {
  const limit = await consumeRateLimit("billing-entitlements", request, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
    const entitlement = await getBillingEntitlement(user.id);
    return Response.json({ entitlement });
  } catch (error) {
    return errorResponse(error, "读取额度失败。", 500);
  }
}
