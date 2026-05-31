# Refactor Boundary

## Codex Ownership

Codex owns non-frontend release work:

- API route validation and error handling.
- AI provider adapter hardening.
- Server-only API key handling and encryption.
- Rate limiting and abuse controls.
- Debate engine correctness and state transitions.
- Database/schema changes.
- Billing, entitlement, and usage-metering service boundaries.
- Cost estimation and provider pricing.
- Tests, security scans, build checks, and documentation.

## Gemini CLI and Grok Build Ownership

Frontend implementation is delegated to Gemini CLI and Grok Build:

- Landing, dashboard, setup, room, history, settings UI implementation.
- Premium visual refinements, responsive behavior, animations, and empty/loading/error states.
- Conversion-oriented upgrade/paywall UI once backend entitlement endpoints exist.
- Frontend evidence screenshots for final scoring.

## Hard Constraints

- Browser code must never receive model provider API keys.
- React components must call local API routes only.
- Mock mode must keep working without real keys.
- Public launch requires all three evaluator scores to be >= 90/100.
