# Security Readiness

## Implemented

- Provider keys are accepted only through server routes.
- Real provider key storage requires `API_KEY_ENCRYPTION_SECRET` with at least 32 characters.
- Stored keys use AES-256-GCM through `lib/security/secrets.ts`.
- Legacy local `local:` values can still be read for migration, but new writes require encryption.
- Expensive API routes have in-memory rate limits.
- Provider errors are sanitized before returning to the browser.
- `pnpm security:scan` checks for obvious client-side key exposure patterns.

## Required Before Production

- Configure `API_KEY_ENCRYPTION_SECRET` in the deployment environment.
- Replace demo user fallback with real authentication.
- Add CSRF protection if cookie-based authenticated mutations are introduced.
- Add durable rate limiting backed by Redis or the deployment platform.
- Add privacy policy, terms, deletion, and export flows.
- Configure provider allowlists for custom OpenAI-compatible base URLs.
