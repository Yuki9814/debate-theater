import { z } from "zod";
import { getSafeCheckoutOrigin } from "@/lib/billing/checkout-origin";
import { createStripeCheckoutSession } from "@/lib/billing/stripe";
import { requireCurrentUser } from "@/lib/auth/session";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const checkoutSchema = z.object({
  planId: z.enum(["pro", "studio"]),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("billing-checkout", request, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const body = checkoutSchema.parse(await request.json());
    const origin = getSafeCheckoutOrigin(request);
    const checkout = await createStripeCheckoutSession({
      userId: user.id,
      planId: body.planId,
      origin,
    });

    return Response.json({ checkout });
  } catch (error) {
    return errorResponse(error, "创建支付会话失败。");
  }
}
