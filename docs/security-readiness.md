# Security Readiness

## Implemented

- Provider keys are accepted only through server routes.
- Real provider key storage requires `API_KEY_ENCRYPTION_SECRET` with at least 32 characters.
- Stored keys use AES-256-GCM through `lib/security/secrets.ts`.
- Legacy local `local:` values can still be read for migration, but new writes require encryption.
- Expensive API routes have in-memory rate limits.
- Production rate limiting can fail closed through Upstash when `RATE_LIMIT_BACKEND=upstash` is configured.
- Magic-link login can send email through `EMAIL_PROVIDER=resend`; production responses do not expose the verification URL.
- Admin health checks now report app origin, auth/email, Stripe, Tavily, Upstash, and monitoring readiness.
- Provider errors are sanitized before returning to the browser.
- `pnpm security:scan` checks for obvious client-side key exposure patterns.

## Required Before Production

- Configure `APP_ORIGIN` to the deployed origin.
- Configure `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `RESEND_API_KEY` for real login delivery.
- Configure `API_KEY_ENCRYPTION_SECRET` in the deployment environment.
- Keep `DEMO_MODE=false` in production.
- Configure durable rate limiting with Upstash or an equivalent platform backend.
- Configure monitoring with `SENTRY_DSN` or `OTEL_EXPORTER_OTLP_ENDPOINT`.
- Configure provider allowlists for custom OpenAI-compatible base URLs.
