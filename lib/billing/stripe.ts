import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors.ts";
import { getPlan } from "./plans.ts";

type CheckoutInput = {
  userId: string;
  planId: "pro" | "studio";
  origin: string;
};

type StripeSessionResponse = {
  id?: string;
  url?: string;
  customer?: string;
  subscription?: string;
  error?: {
    message?: string;
  };
};

function stripeConfigValue(value: string | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function stripeSecretKey() {
  return stripeConfigValue(process.env.STRIPE_SECRET_KEY);
}

function stripePriceId(planId: string) {
  const key = `STRIPE_PRICE_${planId.toUpperCase()}_MONTHLY`;
  return stripeConfigValue(process.env[key]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripeResponseString(value: unknown) {
  if (typeof value !== "string") return undefined;
  return value.trim() ? value : undefined;
}

function normalizeStripeSessionResponse(value: unknown): StripeSessionResponse {
  if (!isRecord(value)) return {};

  const payload: StripeSessionResponse = {};
  const id = stripeResponseString(value.id);
  const url = stripeResponseString(value.url);
  const customer = stripeResponseString(value.customer);
  const subscription = stripeResponseString(value.subscription);

  if (id) payload.id = id;
  if (url) payload.url = url;
  if (customer) payload.customer = customer;
  if (subscription) payload.subscription = subscription;

  const errorMessage = isRecord(value.error) ? stripeResponseString(value.error.message) : undefined;
  if (errorMessage) payload.error = { message: errorMessage };

  return payload;
}

async function readStripeSessionResponse(response: Response) {
  try {
    return normalizeStripeSessionResponse(await response.json());
  } catch {
    return {};
  }
}

export function getStripeWebhookSecret() {
  return stripeConfigValue(process.env.STRIPE_WEBHOOK_SECRET);
}

export async function createStripeCheckoutSession(input: CheckoutInput) {
  const secretKey = stripeSecretKey();
  const priceId = stripePriceId(input.planId);
  const plan = getPlan(input.planId);

  if (!secretKey || !priceId) {
    throw new AppError("Stripe checkout is not configured on the server.", 503, "STRIPE_NOT_CONFIGURED");
  }

  const body = new URLSearchParams();
  body.set("mode", "subscription");
  body.set("success_url", `${input.origin}/dashboard?checkout=success`);
  body.set("cancel_url", `${input.origin}/dashboard?checkout=cancelled`);
  body.set("client_reference_id", input.userId);
  body.set("line_items[0][price]", priceId);
  body.set("line_items[0][quantity]", "1");
  body.set("metadata[userId]", input.userId);
  body.set("metadata[planId]", plan.id);

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await readStripeSessionResponse(response);

  if (!response.ok || !payload.id || !payload.url) {
    console.error("Stripe checkout creation failed", {
      status: response.status,
      message: payload.error?.message,
    });
    throw new AppError("Stripe checkout session could not be created.", 502, "STRIPE_CHECKOUT_FAILED");
  }

  return {
    id: payload.id,
    url: payload.url,
  };
}

export function verifyStripeSignature(payload: string, signatureHeader: string | null, secret: string) {
  if (!signatureHeader) {
    throw new AppError("Missing Stripe-Signature header.", 400, "STRIPE_SIGNATURE_MISSING");
  }

  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of signatureHeader.split(",")) {
    const [rawKey, rawValue] = part.split("=");
    if (!rawKey || rawValue === undefined) continue;

    const key = rawKey.trim();
    const value = rawValue.trim();

    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signatures.push(value);
    }
  }

  if (!timestamp || signatures.length === 0) {
    throw new AppError("Invalid Stripe signature header.", 400, "STRIPE_SIGNATURE_INVALID");
  }

  const timestampSeconds = Number(timestamp);
  if (!Number.isSafeInteger(timestampSeconds)) {
    throw new AppError("Invalid Stripe signature header.", 400, "STRIPE_SIGNATURE_INVALID");
  }

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  const signatureMatched = signatures.some((signature) => {
    const actualBuffer = Buffer.from(signature, "hex");
    return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
  });

  if (!signatureMatched) {
    throw new AppError("Stripe webhook signature verification failed.", 400, "STRIPE_SIGNATURE_INVALID");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > 300) {
    throw new AppError("Stripe webhook timestamp outside tolerance window.", 400, "STRIPE_SIGNATURE_TIMESTAMP_OUT_OF_RANGE");
  }
}

export function normalizeStripePeriodEnd(value: unknown): Date | null {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    !Number.isSafeInteger(value) ||
    value <= 0
  ) {
    return null;
  }

  const milliseconds = value * 1000;
  if (!Number.isFinite(milliseconds)) return null;

  const date = new Date(milliseconds);
  return Number.isFinite(date.getTime()) ? date : null;
}
