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

- Prevented duplicate model spend and duplicate rounds from concurrent tabs or app processes.
- Prevented an expired lease owner from pausing a round already resumed by another process.
