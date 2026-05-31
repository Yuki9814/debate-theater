import { getStripeWebhookSecret, normalizeStripePeriodEnd, verifyStripeSignature } from "@/lib/billing/stripe";
import { validatePaidPlan } from "@/lib/billing/plans";
import { prisma } from "@/lib/db/prisma";
import { AppError, errorResponse } from "@/lib/errors";

type StripeEvent = {
  type: string;
  data?: {
    object?: {
      id?: string;
      customer?: string;
      subscription?: string;
      status?: string;
      client_reference_id?: string;
      metadata?: {
        userId?: string;
        planId?: string;
      };
      current_period_end?: number;
    };
  };
};

export async function POST(request: Request) {
  const secret = getStripeWebhookSecret();
  if (!secret) {
    return errorResponse(
      new AppError("Stripe webhook secret is not configured.", 503, "STRIPE_WEBHOOK_NOT_CONFIGURED"),
      "Stripe webhook 未配置。",
    );
  }

  const payload = await request.text();

  try {
    verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret);
    const event = JSON.parse(payload) as StripeEvent;
    const object = event.data?.object;

    if (event.type === "checkout.session.completed" && object) {
      const userId = object.metadata?.userId ?? object.client_reference_id;
      const planId = validatePaidPlan(object.metadata?.planId);
      const subscriptionId =
        typeof object.subscription === "string" ? object.subscription : object.id;

      if (userId && subscriptionId) {
        await prisma.billingSubscription.upsertByStripeSubscription({
          userId,
          planId,
          status: "active",
          stripeCustomerId: typeof object.customer === "string" ? object.customer : null,
          stripeSubscriptionId: subscriptionId,
          currentPeriodEnd: null,
        });
      }
    }

    if (
      (event.type === "customer.subscription.updated" ||
        event.type === "customer.subscription.deleted") &&
      object?.id
    ) {
      await prisma.billingSubscription.updateByStripeSubscription({
        stripeSubscriptionId: object.id,
        status: object.status ?? "unknown",
        currentPeriodEnd: normalizeStripePeriodEnd(object.current_period_end),
      });
    }

    return Response.json({ received: true });
  } catch (error) {
    return errorResponse(error, "Stripe webhook 处理失败。");
  }
}
