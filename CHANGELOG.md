# Changelog

All notable changes to Debate Theater are documented here.

## [0.2.0] - 2026-08-21

### Added

- Database-backed round execution records and per-request aliases.
- Cross-process leases that reject concurrent generation of the same round.
- Durable checkpoints after speaker A, speaker B, and judge stages.
- Client-generated idempotency keys that survive an SSE/network retry.
- Real execution-stage SSE progress events.

### Changed

- Round, judge scores, usage event, session advancement, and completion state now commit atomically.
- Failed rounds pause safely and can resume from the last completed stage.

### Fixed

- Prevented duplicate durable rounds and duplicate round-usage rows from concurrent tabs, app processes, and rolling legacy reconciliation; a provider response that races a process crash can still require provider-level idempotency.
- Prevented an expired lease owner from pausing a round already resumed by another process.
- Preserved newer user pause/stop/winner controls during completion, reconciled complete legacy orphan rounds, and safely discarded incomplete legacy rounds without charging them.
