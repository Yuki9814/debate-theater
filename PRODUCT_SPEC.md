# Product Spec: 论衡剧场 / Debate Theater

## Vision

Debate Theater is a premium AI debate web app where a user enters a topic, two AI debaters choose opposing sides, and a third AI judge scores each round with structured criteria. The MVP focuses on the Free Debate Arena while leaving clean extension points for persona debates, hot-topic research debates, and historical companion mode.

## Core Capabilities

1. User inputs a debate topic.
2. Two AI agents automatically choose opposing sides or use user-defined sides.
3. A third AI acts as judge and scores each round.
4. If one side scores below a threshold for several consecutive rounds, the judge may declare that side lost.
5. User has highest authority: pause, continue, stop, change round limit, and override judge result.
6. Every 10 rounds by default, the system pauses and asks user to confirm before continuing.
7. User can set max rounds to avoid unlimited token usage.
8. The app supports up to three AI API providers through provider adapters.
9. API keys stay server-side and are never exposed in the browser.
10. Mock mode allows the UI to run without real API keys.
11. Each logical round has one durable execution record. Retries reuse completed stages and commit round, scores, usage, and session state atomically.
12. The UI must feel polished, modern, beautiful, and app-like.

## Main Modules

- Free Debate Arena: Phase 1 MVP.
- Persona Debate: visible coming-soon module with architecture stubs.
- Hot Topic Debate with web search: visible coming-soon module with architecture stubs.
- Historical Companion Mode: visible coming-soon module with architecture stubs.

## Phase 1 MVP Pages

1. Landing page
2. Dashboard
3. Debate setup page
4. Debate room
5. Debate history page
6. Settings page for API providers

## Debate Setup

The setup page allows configuration for:

- Topic
- Debate mode: auto opposing sides or user-defined sides
- Max rounds, default 30
- Pause every N rounds, default 10
- Low score threshold, default 55
- Consecutive low-score limit, default 3
- Judge confidence threshold, default 0.75
- Output mode: full paragraph, sentence-by-sentence, theater mode
- Model/provider for debater A
- Model/provider for debater B
- Model/provider for judge

## Debate Room

The room includes:

- Left panel: AI debater A
- Right panel: AI debater B
- Center/top panel: judge, score, current round, winner state
- Controls: start, pause, resume, stop, next round, force end
- Scoreboard
- Round history
- Token/cost estimate placeholder
- Smooth animations and streaming-like display

Every debate round contains:

1. A speaks.
2. B replies.
3. Judge scores both sides.
4. System updates score.
5. System checks whether to pause, continue, or end.

## Judge Scoring Rules

The judge scores each side from 0 to 100.

Scoring dimensions:

- Logic: 30 points
- Evidence: 25 points
- Rebuttal: 20 points
- Clarity: 15 points
- Persona fidelity: 10 points

If persona mode is disabled, persona fidelity can be ignored or treated as full score.

Judge JSON shape:

```json
{
  "round": 1,
  "scores": {
    "A": {
      "logic": 0,
      "evidence": 0,
      "rebuttal": 0,
      "clarity": 0,
      "persona_fidelity": 0,
      "total": 0
    },
    "B": {
      "logic": 0,
      "evidence": 0,
      "rebuttal": 0,
      "clarity": 0,
      "persona_fidelity": 0,
      "total": 0
    }
  },
  "summary": "",
  "judge_comment": "",
  "possible_loser": "A | B | null",
  "should_end": false,
  "confidence": 0.0
}
```

Default lose condition:

- One side scores below 55 for 3 consecutive rounds.
- The other side leads by at least 10 average points.
- Judge confidence is at least 0.75.
- User can always override the judge.

## Technical Stack

- Next.js
- TypeScript
- Tailwind CSS
- shadcn/ui-style components
- Framer Motion
- Prisma
- SQLite for local MVP
- Execution-stage SSE streaming
- Database-backed idempotency, leases, and stage checkpoints
- OpenAI provider adapter placeholder
- Mock AI provider

## Architecture

Folders:

- `app/`
- `components/`
- `components/debate/`
- `components/persona/`
- `components/layout/`
- `lib/ai/`
- `lib/debate/`
- `lib/judge/`
- `lib/persona/`
- `lib/research/`
- `lib/db/`
- `prisma/`

AI calls must go through server-side API routes and provider adapters. React components must not call model APIs directly.

## Future Stubs

Persona Debate should support historical and philosophical presets, including Confucius, Laozi, Han Feizi, Socrates, Plato, Aristotle, Machiavelli, Nietzsche, Kant, Sun Tzu, Napoleon, Caesar, Zhuge Liang, Cao Cao, Shakespeare, Dostoevsky, Lu Xun, Tolstoy, and Churchill.

Hot Topic Debate should support web search, neutral source cards, a shared research pack, and judge penalties for unsupported claims or hallucinated facts.

Historical Companion Mode should distinguish historical fact, reasonable inference, and fictional branch while showing a worldline timeline and branch decisions.

## UI Direction

The product should use a dark elegant interface, glassmorphism cards, soft gradient background, subtle glow effects, smooth motion, beautiful typography, and an app-like layout. It must not feel like a plain form demo.
