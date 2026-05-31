# Codex Evaluation Rubric: Launchable and Profitable Debate Theater

This rubric is the Codex-side baseline for refactoring "论衡剧场 / Debate Theater" into a launchable, monetizable product. Final acceptance requires a score of at least 90/100 from Codex, Gemini CLI, and Grok Build.

## Score Table

| Area | Points | Acceptance Focus |
| --- | ---: | --- |
| Commercial model and monetization | 15 | Clear pricing, upgrade path, paid entitlement model, usage limits |
| Product positioning | 8 | Specific audience, differentiated value, strong messaging |
| AI debate core loop | 15 | Reliable multi-agent rounds, judge scoring, stop/pause/resume, persistence |
| Provider and API key security | 12 | Server-only keys, adapters, BYOK isolation, encrypted storage |
| Billing and subscription readiness | 10 | Stripe-ready service boundary, checkout/webhook stubs, entitlement checks |
| Cost control | 8 | Token estimates, quotas, rate limits, max rounds, provider cost tracking |
| Data persistence and account model | 8 | Sessions, rounds, participants, scores, settings, recoverability |
| Safety, compliance, and privacy | 8 | Terms/privacy placeholders, abuse controls, prompt-injection resistance |
| Testing and release operations | 10 | Lint/type/build/test, seed/mock mode, deployment docs, env validation |
| Frontend product quality | 6 | Premium UI, responsive app flows, conversion-ready polish |
| Total | 100 | Pass threshold: 90+ |

## Acceptance Details

### Commercial Model and Monetization - 15

- 4 pts: Published pricing structure for free, paid, and BYOK usage.
- 3 pts: Upgrade entry points appear naturally in the product workflow.
- 3 pts: Entitlement logic exists server-side and cannot be bypassed by client state.
- 3 pts: Free quota, max round limits, and premium model gates are represented in code.
- 2 pts: Business assumptions are documented in README or product docs.

### Product Positioning - 8

- 3 pts: The product explains why structured AI debate is different from generic chat.
- 2 pts: Target users and use cases are explicit.
- 2 pts: The MVP keeps Free Debate Arena primary while future modules are clearly secondary.
- 1 pt: Tone and naming are consistent across docs and UI.

### AI Debate Core Loop - 15

- 4 pts: Debate sessions progress deterministically through A speaks, B replies, judge scores, state update, pause/end decision.
- 3 pts: Judge JSON is validated before persistence.
- 2 pts: User authority controls pause, resume, stop, next round, force end, and result override.
- 2 pts: Every-N-round confirmation and max-round limits are enforced server-side.
- 2 pts: Mock mode supports realistic demos without provider keys.
- 2 pts: Failure states return usable errors without corrupting session state.

### Provider and API Key Security - 12

- 4 pts: Browser code never receives platform API keys.
- 3 pts: All model calls go through server routes and provider adapters.
- 2 pts: User provider credentials are encrypted at rest or clearly blocked until encryption is configured.
- 2 pts: Provider errors are sanitized before reaching the browser.
- 1 pt: `.env.example` documents all required secrets without defaults that look production-ready.

### Billing and Subscription Readiness - 10

- 3 pts: Billing service API exists with entitlement checks independent from UI.
- 2 pts: Stripe or equivalent checkout/webhook integration points are isolated and testable.
- 2 pts: Subscription status can be persisted and queried.
- 2 pts: Usage metering connects debate rounds to cost/account limits.
- 1 pt: Local development can run in mock billing mode.

### Cost Control - 8

- 2 pts: Token/cost estimates are tracked per round.
- 2 pts: Max rounds and pause cadence cannot be bypassed by direct API calls.
- 2 pts: Rate limits or abuse guards exist for expensive endpoints.
- 1 pt: Provider/model pricing is centralized.
- 1 pt: Long debates have an explicit summarization or context-budget strategy.

### Data Persistence and Account Model - 8

- 2 pts: Database models cover users, providers, sessions, participants, rounds, scores, and personas.
- 2 pts: Debate history loads from persisted data.
- 2 pts: In-progress sessions can be resumed or safely marked ended.
- 1 pt: Seed/mock data supports local demos.
- 1 pt: Prisma/database setup is documented and build-safe.

### Safety, Compliance, and Privacy - 8

- 2 pts: Terms and privacy pages or document stubs exist before public launch.
- 2 pts: Input validation and prompt-injection mitigations protect judge/provider prompts.
- 2 pts: User data deletion/export path is planned or stubbed.
- 1 pt: Logs avoid sensitive prompt/key leakage.
- 1 pt: Abuse/content moderation hooks are present.

### Testing and Release Operations - 10

- 2 pts: `pnpm lint` passes.
- 2 pts: `pnpm build` passes.
- 2 pts: Core debate engine and judge scoring have unit tests.
- 1 pt: API routes have tests for validation and server-only guarantees.
- 1 pt: Playwright or equivalent covers the core create-debate-run-history path.
- 1 pt: README explains local setup, mock mode, env vars, and deployment.
- 1 pt: CI/deployment checklist exists.

### Frontend Product Quality - 6

- 2 pts: Visual design feels like a premium AI app rather than a demo.
- 1 pt: Mobile and desktop layouts are usable without overlap.
- 1 pt: Debate room makes current speaker, score, status, and controls obvious.
- 1 pt: Streaming-like display and animations improve comprehension without hiding state.
- 1 pt: Empty/loading/error states are polished.

## Fatal Failures

Any item below prevents passing even if the numeric score is 90+:

- API keys or provider secrets are exposed to browser JavaScript.
- Production build fails.
- A complete mock debate cannot run without real API keys.
- The app has no credible monetization or entitlement path.
- Paid usage limits can be bypassed by editing client-side state.
- Debate state can corrupt or cross users during ordinary use.
- Core pages are unusable on mobile.
- No persisted history exists after a debate completes.
