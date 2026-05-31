# 论衡剧场 / Debate Theater

Premium AI debate web app built with Next.js, TypeScript, Tailwind CSS, shadcn-style UI primitives, Framer Motion, Prisma schema modeling, and local SQLite persistence.

## Phase 1 MVP

- Landing page, dashboard, setup page, debate room, history, and API provider settings.
- Free Debate Arena with two AI debaters and one AI judge.
- Mock provider works without real API keys.
- OpenAI and OpenAI-compatible server-side provider adapters are in place.
- Judge outputs structured JSON and scores logic, evidence, rebuttal, clarity, and persona fidelity.
- Round limit, pause-every-N-rounds, stop/resume, next round, force end, and override controls.
- Debate history persists through local SQLite. Prisma schema/config are included for the data model and generated client workflow.
- Persona Debate, Hot Topic Debate, and Historical Companion Mode are visible coming-soon modules with stubs.
- Server-side billing and entitlement boundaries are in place for a profitable launch path.
- Provider keys are encrypted at rest when `API_KEY_ENCRYPTION_SECRET` is configured.
- Core backend logic has Node test coverage and a lightweight security scan.

## Setup

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm dev
```

Open `http://localhost:3000`.

## Environment

```bash
DATABASE_URL="file:./dev.db"
API_KEY_ENCRYPTION_SECRET=""
OPENAI_API_KEY=""
OPENAI_BASE_URL="https://api.openai.com/v1"
OPENAI_DEFAULT_MODEL="gpt-4.1-mini"
BILLING_MODE="mock"
PLATFORM_FREE_ROUND_CREDITS="120"
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PRICE_PRO_MONTHLY=""
STRIPE_PRICE_STUDIO_MONTHLY=""
```

Do not expose provider keys with `NEXT_PUBLIC_`. Browser code only calls local API routes; model calls stay behind server-side adapters.

Real provider key storage requires `API_KEY_ENCRYPTION_SECRET` to be at least 32 random characters. Without it, mock mode still works, but saving real keys is blocked.

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm security:scan
pnpm build
```

`pnpm verify` runs the full local verification chain.

## Launch Readiness Docs

- `docs/billing-readiness.md` documents monetization and subscription boundaries.
- `docs/security-readiness.md` documents key handling, rate limiting, and production security gaps.

## Build

```bash
pnpm build
```

The build script runs `prisma generate` before `next build`. The app also creates the local SQLite tables on first database access, so mock mode works even when Prisma CLI migration commands are unavailable in a local environment.

## Notes

Prisma 7 uses `prisma.config.ts` for the datasource URL and generates the client into `lib/generated/prisma` during build. The local runtime uses Node's built-in SQLite API to avoid macOS library-validation issues with third-party native database drivers inside the Codex desktop runtime.
