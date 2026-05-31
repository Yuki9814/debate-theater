# Final Acceptance Protocol

The project is accepted only when all three evaluators score the finished refactor at **90/100 or higher**:

- Codex
- Gemini CLI
- Grok Build

## Process

1. Run the local verification suite: lint, type/build, unit tests, and browser smoke tests.
2. Collect implementation evidence: screenshots, build logs, test logs, and security notes.
3. Ask each evaluator to score the final project against its own rubric.
4. If any score is below 90, convert the lowest-scoring categories into a fix list and repeat.
5. Do not mark the goal complete while any fatal failure remains.

## Frontend Boundary

Codex may review, test, secure, and orchestrate frontend work, but direct frontend implementation should be assigned to Gemini CLI and Grok Build according to the user's instruction.

## Non-Frontend Ownership

Codex owns backend architecture, AI provider adapters, database work, security checks, tests, documentation, deployment readiness, billing/service boundaries, and final verification.
