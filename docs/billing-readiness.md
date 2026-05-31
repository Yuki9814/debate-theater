# Billing Readiness

The current implementation uses mock billing locally while enforcing a real server-side entitlement boundary.

## Implemented

- `lib/billing/plans.ts` defines free, pro, and studio plans.
- `lib/billing/service.ts` exposes entitlement checks and usage recording.
- `app/api/billing/entitlements` returns current plan, usage, and remaining round quota.
- `app/api/billing/checkout` creates Stripe Checkout Sessions when Stripe env vars are configured.
- `app/api/billing/webhook` verifies Stripe webhook signatures and persists subscription status.
- Debate round generation calls `assertCanRunRound` before model calls.
- Debate round generation records a `UsageEvent` after a successful round.
- `DebateRound` stores estimated input tokens, output tokens, and estimated cost.

## Production Upgrade Path

1. Create Stripe recurring Prices for Pro and Studio.
2. Set `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_STUDIO_MONTHLY`.
3. Configure `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`.
4. Point the Stripe webhook endpoint to `/api/billing/webhook`.
5. Replace demo user fallback with real authenticated users before public billing.

## Environment

- `BILLING_MODE=mock` keeps local development usable.
- `PLATFORM_FREE_ROUND_CREDITS` controls local free monthly round limits.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are reserved for production billing.
- `STRIPE_PRICE_PRO_MONTHLY` and `STRIPE_PRICE_STUDIO_MONTHLY` map paid plans to Stripe recurring Prices.
