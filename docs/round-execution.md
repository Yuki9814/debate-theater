# Durable Round Execution

Version 0.2.0 replaces the process-local round lock with a SQLite-backed execution protocol.

## Contract

Every round request carries an `Idempotency-Key`. The browser keeps the same key while retrying one target round. The server also maps every accepted retry key to the unique `(sessionId, roundNumber)` execution.

`BEGIN IMMEDIATE` serializes claims across SQLite connections. A claim has a 15-minute renewable lease and one opaque owner token. While that lease is active, another request receives `409 ROUND_ALREADY_IN_PROGRESS` instead of starting more provider calls.

The engine persists these checkpoints:

1. speaker A output and usage;
2. speaker B output and usage;
3. judge result and usage;
4. atomic round completion.

After a provider or network failure, the lease is released and the session pauses. A retry starts at the first incomplete stage. A completed request is replayed by reloading the already-advanced session. The response also carries the execution's `roundId`, so an older key stays bound to its original round after later rounds exist.

## Atomic completion

One transaction writes the debate round, both judge scores, one usage event, the next session state, and the completed execution record. Any failed statement rolls back the entire group.

## Failure and recovery boundaries

- An SSE disconnect does not cancel or roll back durable server work.
- Once an SSE response has been created, failures are delivered as an `event: error` frame. The server sends the newest paused session first when it can reload it, so the client can render durable recovery state.
- If a worker disappears, another request can resume after the lease expires.
- A stale worker cannot checkpoint after another worker acquires its lease.
- Checkpoints prevent repeated calls after a confirmed stage write. A process crash between a provider response and its checkpoint can still repeat that one provider call; provider-level idempotency should be added when an upstream supports it.
- Session control updates carry a monotonic control version. Completion uses a compare-and-set against that version, so a newer pause, stop, or forced winner is never overwritten; only the round and usage accounting are advanced.
- A round found without its execution record is treated as a legacy orphan: it is bound once, usage is filled once, and a non-terminal session is paused for safe review.
- SQLite coordination requires every process to use the same database file with working file locks. Separate hosts or independent volumes need a shared transactional database implementation.

## Verification

`lib/db/round-executions.test.ts` opens two independent SQLite connections and proves exclusive ownership, checkpoint recovery, atomic completion, and completed-request replay. The full `pnpm verify` gate also runs lint, type checking, security scanning, and a production build.
