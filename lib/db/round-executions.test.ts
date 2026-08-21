import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureDatabase } from "./prisma.ts";
import { RoundExecutionStore, roundExecutionStore } from "./round-executions.ts";
import { runNextRoundExecution } from "../debate/engine.ts";
import type { JudgeResult } from "../debate/types.ts";

const directory = mkdtempSync(join(tmpdir(), "debate-round-executions-"));
const databasePath = join(directory, "rounds.db");
process.env.DATABASE_URL = `file:${databasePath}`;

let first: RoundExecutionStore;
let second: RoundExecutionStore;
let defaultStoreCreated = false;

const usage = { inputTokens: 10, outputTokens: 5, estimatedCostUsd: 0.001 };
const judgeResult: JudgeResult = {
  round: 1,
  scores: {
    A: { logic: 18, evidence: 17, rebuttal: 16, clarity: 15, persona_fidelity: 14, total: 80 },
    B: { logic: 16, evidence: 15, rebuttal: 14, clarity: 13, persona_fidelity: 12, total: 70 },
  },
  summary: "A leads",
  judge_comment: "Continue",
  possible_loser: null,
  should_end: false,
  confidence: 0.8,
};

function seedSession(store: RoundExecutionStore, sessionId: string, userId: string): void {
  const now = new Date().toISOString();
  store.database
    .prepare(`INSERT INTO "User" ("id", "email", "name", "createdAt") VALUES (?, ?, ?, ?)`)
    .run(userId, `${userId}@example.test`, "Test", now);
  store.database
    .prepare(
      `INSERT INTO "DebateSession"
        ("id", "userId", "mode", "topic", "status", "maxRounds", "pauseEveryRounds", "lowScoreThreshold", "consecutiveLowLimit", "judgeConfidence", "outputMode", "currentRound", "winner", "createdAt", "updatedAt")
       VALUES (?, ?, 'free', 'Fixture topic', 'draft', 10, 5, 55, 3, 0.75, 'theater', 0, NULL, ?, ?)`,
    )
    .run(sessionId, userId, now, now);
}

function insertLegacyRound(
  store: RoundExecutionStore,
  sessionId: string,
  roundNumber: number,
  scoreCount: 0 | 1 | 2,
): string {
  const roundId = randomUUID();
  const now = new Date().toISOString();
  store.database
    .prepare(
      `INSERT INTO "DebateRound"
        ("id", "sessionId", "roundNumber", "speakerAContent", "speakerBContent", "judgeSummary", "judgeComment", "confidence", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
       VALUES (?, ?, ?, 'legacy A', 'legacy B', 'legacy summary', 'legacy comment', 0.8, 11, 7, 0.002, ?)`,
    )
    .run(roundId, sessionId, roundNumber, now);

  const sides = scoreCount === 2 ? (["A", "B"] as const) : scoreCount === 1 ? (["A"] as const) : [];
  for (const side of sides) {
    store.database
      .prepare(
        `INSERT INTO "JudgeScore"
          ("id", "roundId", "side", "logic", "evidence", "rebuttal", "clarity", "personaFidelity", "total", "comment")
         VALUES (?, ?, ?, 18, 17, 16, 15, 14, 80, 'legacy score')`,
      )
      .run(randomUUID(), roundId, side);
  }
  return roundId;
}

function insertLegacyUsage(store: RoundExecutionStore, userId: string, sessionId: string, roundNumber: number): void {
  store.database
    .prepare(
      `INSERT INTO "UsageEvent"
        ("id", "userId", "sessionId", "providerId", "eventType", "roundNumber", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
       VALUES (?, ?, ?, 'legacy', 'debate_round', ?, 11, 7, 0.002, ?)`,
    )
    .run(randomUUID(), userId, sessionId, roundNumber, new Date().toISOString());
}

function insertOtherUsage(store: RoundExecutionStore, userId: string, sessionId: string, roundNumber: number): void {
  store.database
    .prepare(
      `INSERT INTO "UsageEvent"
        ("id", "userId", "sessionId", "providerId", "eventType", "roundNumber", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
       VALUES (?, ?, ?, 'other', 'other', ?, 1, 1, 0, ?)`,
    )
    .run(randomUUID(), userId, sessionId, roundNumber, new Date().toISOString());
}

before(async () => {
  await ensureDatabase();
  first = new RoundExecutionStore(databasePath);
  second = new RoundExecutionStore(databasePath);
});

after(() => {
  first.close();
  second.close();
  if (defaultStoreCreated) roundExecutionStore().close();
  rmSync(directory, { recursive: true, force: true });
});

describe("database-backed round execution", () => {
  it("admits one owner across connections and resumes saved checkpoints", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);

    const owner = first.claim({ sessionId, roundNumber: 1, requestId: "request:first-owner" });
    assert.equal(owner.outcome, "claimed");
    assert.ok(owner.ownerToken);

    const concurrent = second.claim({ sessionId, roundNumber: 1, requestId: "request:second-tab" });
    assert.equal(concurrent.outcome, "in_progress");
    assert.equal(concurrent.execution.id, owner.execution.id);

    first.checkpoint({
      executionId: owner.execution.id,
      ownerToken: owner.ownerToken as string,
      stage: "speaker_a_completed",
      speakerAContent: "durable speaker A",
      speakerAUsage: usage,
    });
    first.fail({
      executionId: owner.execution.id,
      ownerToken: owner.ownerToken as string,
      errorCode: "AI_TIMEOUT",
      errorMessage: "provider timed out",
    });

    const resumed = second.claim({ sessionId, roundNumber: 1, requestId: "request:second-tab" });
    assert.equal(resumed.outcome, "resumed");
    assert.equal(resumed.execution.speakerAContent, "durable speaker A");
    assert.deepEqual(resumed.execution.speakerAUsage, usage);
    assert.equal(first.getByRequest(sessionId, "request:first-owner")?.id, resumed.execution.id);
  });

  it("commits round, scores, usage, session state, and execution status atomically", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    const claim = first.claim({ sessionId, roundNumber: 1, requestId: "request:atomic-complete" });
    const ownerToken = claim.ownerToken as string;

    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_a_completed",
      speakerAContent: "A",
      speakerAUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_b_completed",
      speakerBContent: "B",
      speakerBUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "judge_completed",
      judgeResult,
      judgeUsage: usage,
    });

    const completed = first.complete({
      executionId: claim.execution.id,
      ownerToken,
      userId,
      providerId: "mixed",
      sessionStatus: "running",
      winner: null,
      speakerAContent: "A",
      speakerBContent: "B",
      judgeResult,
      usage,
    });

    const roundCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "DebateRound" WHERE "sessionId" = ?`)
      .get(sessionId) as { count: number };
    const scoreCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "JudgeScore" WHERE "roundId" = ?`)
      .get(completed.roundId) as { count: number };
    const usageCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1`)
      .get(sessionId) as { count: number };
    const session = first.database
      .prepare(`SELECT "currentRound", "status" FROM "DebateSession" WHERE "id" = ?`)
      .get(sessionId) as { currentRound: number; status: string };

    assert.equal(roundCount.count, 1);
    assert.equal(scoreCount.count, 2);
    assert.equal(usageCount.count, 1);
    assert.equal(session.currentRound, 1);
    assert.equal(session.status, "running");

    const replay = second.claim({
      sessionId,
      roundNumber: 2,
      requestId: "request:atomic-complete",
    });
    assert.equal(replay.outcome, "completed");
    assert.equal(replay.execution.roundId, completed.roundId);
  });

  it("rolls back every completion side effect when the final execution write fails", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    const claim = first.claim({ sessionId, roundNumber: 1, requestId: "request:rollback-trigger" });
    const ownerToken = claim.ownerToken as string;
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_a_completed",
      speakerAContent: "A",
      speakerAUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_b_completed",
      speakerBContent: "B",
      speakerBUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "judge_completed",
      judgeResult,
      judgeUsage: usage,
    });
    first.database.exec(`
      CREATE TRIGGER "round_execution_test_abort"
      BEFORE UPDATE OF "status" ON "DebateRoundExecution"
      WHEN NEW."status" = 'completed'
      BEGIN
        SELECT RAISE(ABORT, 'forced completion failure');
      END;
    `);

    try {
      assert.throws(() =>
        first.complete({
          executionId: claim.execution.id,
          ownerToken,
          userId,
          providerId: "mock",
          sessionStatus: "running",
          winner: null,
          speakerAContent: "A",
          speakerBContent: "B",
          judgeResult,
          usage,
        }),
      );
    } finally {
      first.database.exec(`DROP TRIGGER "round_execution_test_abort"`);
    }

    const roundCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "DebateRound" WHERE "sessionId" = ?`)
      .get(sessionId) as { count: number };
    const scoreCount = first.database
      .prepare(
        `SELECT COUNT(*) AS count FROM "JudgeScore"
         WHERE "roundId" IN (SELECT "id" FROM "DebateRound" WHERE "sessionId" = ?)`
      )
      .get(sessionId) as { count: number };
    const usageCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ?`)
      .get(sessionId) as { count: number };
    const session = first.database
      .prepare(`SELECT "currentRound" FROM "DebateSession" WHERE "id" = ?`)
      .get(sessionId) as { currentRound: number };
    const execution = first.database
      .prepare(`SELECT "status", "roundId" FROM "DebateRoundExecution" WHERE "id" = ?`)
      .get(claim.execution.id) as { status: string; roundId: string | null };
    assert.equal(roundCount.count, 0);
    assert.equal(scoreCount.count, 0);
    assert.equal(usageCount.count, 0);
    assert.equal(session.currentRound, 0);
    assert.equal(execution.status, "judge_completed");
    assert.equal(execution.roundId, null);
  });

  it("does not let an expired owner pause a round resumed by another process", () => {
    let now = Date.parse("2026-08-21T12:00:00.000Z");
    const expiredOwner = new RoundExecutionStore(databasePath, { clock: () => now, leaseMs: 1_000 });
    const resumedOwner = new RoundExecutionStore(databasePath, { clock: () => now, leaseMs: 1_000 });
    try {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(expiredOwner, sessionId, userId);
      expiredOwner.database
        .prepare(`UPDATE "DebateSession" SET "status" = 'running' WHERE "id" = ?`)
        .run(sessionId);

      const original = expiredOwner.claim({
        sessionId,
        roundNumber: 1,
        requestId: "request:owner-that-expires",
      });
      now += 1_001;
      const resumed = resumedOwner.claim({
        sessionId,
        roundNumber: 1,
        requestId: "request:replacement-owner",
      });
      assert.equal(resumed.outcome, "resumed");

      expiredOwner.fail({
        executionId: original.execution.id,
        ownerToken: original.ownerToken as string,
        errorCode: "STALE_PROVIDER_RESPONSE",
        errorMessage: "the old worker returned after its lease expired",
      });

      const session = expiredOwner.database
        .prepare(`SELECT "status" FROM "DebateSession" WHERE "id" = ?`)
        .get(sessionId) as { status: string };
      assert.equal(session.status, "running");
      assert.equal(
        expiredOwner.getByRequest(sessionId, "request:replacement-owner")?.leaseOwner,
        resumed.ownerToken,
      );
    } finally {
      expiredOwner.close();
      resumedOwner.close();
    }
  });

  it("rejects checkpoints and completion after the lease expires", () => {
    let now = Date.parse("2026-08-21T13:00:00.000Z");
    const expiring = new RoundExecutionStore(databasePath, { clock: () => now, leaseMs: 1_000 });
    try {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(expiring, sessionId, userId);
      const claim = expiring.claim({ sessionId, roundNumber: 1, requestId: "request:lease-expiry" });
      const ownerToken = claim.ownerToken as string;
      expiring.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_a_completed",
        speakerAContent: "A",
        speakerAUsage: usage,
      });
      expiring.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_b_completed",
        speakerBContent: "B",
        speakerBUsage: usage,
      });
      expiring.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "judge_completed",
        judgeResult,
        judgeUsage: usage,
      });
      now += 1_001;

      assert.throws(() =>
        expiring.checkpoint({
          executionId: claim.execution.id,
          ownerToken,
          stage: "judge_completed",
          judgeResult,
          judgeUsage: usage,
        }),
      );
      assert.throws(() =>
        expiring.complete({
          executionId: claim.execution.id,
          ownerToken,
          userId,
          providerId: "mock",
          sessionStatus: "running",
          winner: null,
          speakerAContent: "A",
          speakerBContent: "B",
          judgeResult,
          usage,
        }),
      );
      const roundCount = expiring.database
        .prepare(`SELECT COUNT(*) AS count FROM "DebateRound" WHERE "sessionId" = ?`)
        .get(sessionId) as { count: number };
      const usageCount = expiring.database
        .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ?`)
        .get(sessionId) as { count: number };
      const session = expiring.database
        .prepare(`SELECT "currentRound" FROM "DebateSession" WHERE "id" = ?`)
        .get(sessionId) as { currentRound: number };
      assert.equal(roundCount.count, 0);
      assert.equal(usageCount.count, 0);
      assert.equal(session.currentRound, 0);
    } finally {
      expiring.close();
    }
  });

  it("does not mark an execution failed after its lease has expired", () => {
    let now = Date.parse("2026-08-21T13:30:00.000Z");
    const expiring = new RoundExecutionStore(databasePath, { clock: () => now, leaseMs: 1_000 });
    try {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(expiring, sessionId, userId);
      const claim = expiring.claim({ sessionId, roundNumber: 1, requestId: "request:expired-fail" });
      const ownerToken = claim.ownerToken as string;
      now += 1_001;

      expiring.fail({
        executionId: claim.execution.id,
        ownerToken,
        errorCode: "STALE_PROVIDER_RESPONSE",
        errorMessage: "the lease is already expired",
      });

      const execution = expiring.getByRequest(sessionId, "request:expired-fail");
      assert.equal(execution?.status, "claimed");
      assert.equal(execution?.leaseOwner, ownerToken);
      assert.equal(execution?.errorCode, null);
    } finally {
      expiring.close();
    }
  });

  it("preserves a newer user stop and forced winner while completion only advances accounting", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    const claim = first.claim({ sessionId, roundNumber: 1, requestId: "request:user-control-race" });
    const ownerToken = claim.ownerToken as string;
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_a_completed",
      speakerAContent: "A",
      speakerAUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "speaker_b_completed",
      speakerBContent: "B",
      speakerBUsage: usage,
    });
    first.checkpoint({
      executionId: claim.execution.id,
      ownerToken,
      stage: "judge_completed",
      judgeResult,
      judgeUsage: usage,
    });
    first.database
      .prepare(
        `UPDATE "DebateSession"
         SET "status" = 'stopped', "winner" = 'A', "controlVersion" = "controlVersion" + 1
         WHERE "id" = ?`,
      )
      .run(sessionId);

    first.complete({
      executionId: claim.execution.id,
      ownerToken,
      userId,
      providerId: "mock",
      sessionStatus: "ended",
      winner: "B",
      speakerAContent: "A",
      speakerBContent: "B",
      judgeResult,
      usage,
    });

    const session = first.database
      .prepare(`SELECT "currentRound", "status", "winner" FROM "DebateSession" WHERE "id" = ?`)
      .get(sessionId) as { currentRound: number; status: string; winner: string };
    assert.equal(session.currentRound, 1);
    assert.equal(session.status, "stopped");
    assert.equal(session.winner, "A");
  });

  it("refreshes the execution control version when a failed round is resumed after user recovery", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    const original = first.claim({ sessionId, roundNumber: 1, requestId: "request:failed-before-recovery" });
    first.fail({
      executionId: original.execution.id,
      ownerToken: original.ownerToken as string,
      errorCode: "AI_TIMEOUT",
      errorMessage: "provider timed out",
    });
    first.database
      .prepare(
        `UPDATE "DebateSession"
         SET "status" = 'running', "controlVersion" = "controlVersion" + 1
         WHERE "id" = ?`,
      )
      .run(sessionId);

    const resumed = second.claim({ sessionId, roundNumber: 1, requestId: "request:recovery-retry" });
    assert.equal(resumed.outcome, "resumed");
    assert.equal(resumed.execution.controlVersion, 1);
    assert.ok(resumed.ownerToken);
    const checkpoint = second.checkpoint({
      executionId: resumed.execution.id,
      ownerToken: resumed.ownerToken as string,
      stage: "speaker_a_completed",
      speakerAContent: "recovered A",
      speakerAUsage: usage,
    });
    assert.equal(checkpoint.speakerAContent, "recovered A");
  });

  it("keeps rolling old and new usage writers at one event per session round", () => {
    const oldFirstSessionId = randomUUID();
    const oldFirstUserId = randomUUID();
    seedSession(first, oldFirstSessionId, oldFirstUserId);
    const oldFirstRoundId = insertLegacyRound(first, oldFirstSessionId, 1, 2);
    insertLegacyUsage(first, oldFirstUserId, oldFirstSessionId, 1);

    const oldFirstReconciled = second.claim({
      sessionId: oldFirstSessionId,
      roundNumber: 1,
      requestId: "request:old-writer-first",
      userId: oldFirstUserId,
      providerId: "mock",
    });
    assert.equal(oldFirstReconciled.outcome, "completed");
    assert.equal(oldFirstReconciled.execution.roundId, oldFirstRoundId);

    const newFirstSessionId = randomUUID();
    const newFirstUserId = randomUUID();
    seedSession(first, newFirstSessionId, newFirstUserId);
    const newFirstRoundId = insertLegacyRound(first, newFirstSessionId, 1, 2);
    insertOtherUsage(first, newFirstUserId, newFirstSessionId, 1);
    insertOtherUsage(first, newFirstUserId, newFirstSessionId, 1);
    const newFirstReconciled = first.claim({
      sessionId: newFirstSessionId,
      roundNumber: 1,
      requestId: "request:new-writer-first",
      userId: newFirstUserId,
      providerId: "mock",
    });
    assert.equal(newFirstReconciled.outcome, "completed");
    assert.equal(newFirstReconciled.execution.roundId, newFirstRoundId);

    assert.throws(() => insertLegacyUsage(second, newFirstUserId, newFirstSessionId, 1));
    const usageCount = first.database
      .prepare(
        `SELECT COUNT(*) AS count FROM "UsageEvent"
         WHERE "sessionId" = ? AND "roundNumber" = 1 AND "eventType" = 'debate_round'`,
      )
      .get(newFirstSessionId) as { count: number };
    assert.equal(usageCount.count, 1);
    const otherUsageCount = first.database
      .prepare(
        `SELECT COUNT(*) AS count FROM "UsageEvent"
         WHERE "sessionId" = ? AND "roundNumber" = 1 AND "eventType" = 'other'`,
      )
      .get(newFirstSessionId) as { count: number };
    assert.equal(otherUsageCount.count, 2);
  });

  it("discards zero- and one-score legacy rounds before claiming durable completion", () => {
    const cases = [
      { label: "zero-score", scoreCount: 0 as const, expectOutcome: "claimed" as const },
      { label: "one-score", scoreCount: 1 as const, expectOutcome: "resumed" as const },
    ];

    for (const testCase of cases) {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(first, sessionId, userId);
      if (testCase.scoreCount === 1) {
        const failed = first.claim({
          sessionId,
          roundNumber: 1,
          requestId: `request:${testCase.label}-old-execution`,
        });
        first.fail({
          executionId: failed.execution.id,
          ownerToken: failed.ownerToken as string,
          errorCode: "LEGACY_WORKER_CRASH",
          errorMessage: "old worker left a partial round",
        });
      }

      insertLegacyRound(first, sessionId, 1, testCase.scoreCount);
      const claim = second.claim({
        sessionId,
        roundNumber: 1,
        requestId: `request:${testCase.label}-recovery`,
        userId,
        providerId: "mock",
      });
      assert.equal(claim.outcome, testCase.expectOutcome);
      assert.equal(claim.execution.roundId, null);

      const partialRoundCount = first.database
        .prepare(`SELECT COUNT(*) AS count FROM "DebateRound" WHERE "sessionId" = ?`)
        .get(sessionId) as { count: number };
      const partialScoreCount = first.database
        .prepare(
          `SELECT COUNT(*) AS count FROM "JudgeScore"
           WHERE "roundId" IN (SELECT "id" FROM "DebateRound" WHERE "sessionId" = ?)`,
        )
        .get(sessionId) as { count: number };
      const partialUsageCount = first.database
        .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1`)
        .get(sessionId) as { count: number };
      assert.equal(partialRoundCount.count, 0);
      assert.equal(partialScoreCount.count, 0);
      assert.equal(partialUsageCount.count, 0);

      assert.throws(() => insertLegacyUsage(first, userId, sessionId, 1));

      const ownerToken = claim.ownerToken as string;
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_a_completed",
        speakerAContent: "A",
        speakerAUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_b_completed",
        speakerBContent: "B",
        speakerBUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "judge_completed",
        judgeResult,
        judgeUsage: usage,
      });
      const completed = first.complete({
        executionId: claim.execution.id,
        ownerToken,
        userId,
        providerId: "mock",
        sessionStatus: "running",
        winner: null,
        speakerAContent: "A",
        speakerBContent: "B",
        judgeResult,
        usage,
      });
      assert.ok(completed.roundId);

      const durableCounts = first.database
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM "DebateRound" WHERE "sessionId" = ?) AS rounds,
             (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = ?) AS scores,
             (SELECT COUNT(*) FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1) AS usage`,
        )
        .get(sessionId, completed.roundId, sessionId) as { rounds: number; scores: number; usage: number };
      assert.equal(durableCounts.rounds, 1);
      assert.equal(durableCounts.scores, 2);
      assert.equal(durableCounts.usage, 1);
    }
  });

  it("rewinds an advanced partial head before durable completion", () => {
    for (const scoreCount of [0, 1] as const) {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(first, sessionId, userId);
      insertLegacyRound(first, sessionId, 1, scoreCount);
      first.database
        .prepare(
          `UPDATE "DebateSession"
           SET "currentRound" = 1, "status" = 'running', "winner" = 'operator choice'
           WHERE "id" = ?`,
        )
        .run(sessionId);

      const claim = first.claim({
        sessionId,
        roundNumber: 1,
        requestId: `request:advanced-head-${scoreCount}`,
        userId,
        providerId: "mock",
      });
      assert.equal(claim.outcome, "claimed");
      assert.equal(
        (first.database.prepare(`SELECT "currentRound" FROM "DebateSession" WHERE "id" = ?`).get(sessionId) as { currentRound: number })
          .currentRound,
        0,
      );
      assert.equal(
        (first.database.prepare(`SELECT "status" FROM "DebateSession" WHERE "id" = ?`).get(sessionId) as { status: string }).status,
        "paused",
      );
      assert.equal(
        (first.database.prepare(`SELECT "winner" FROM "DebateSession" WHERE "id" = ?`).get(sessionId) as { winner: string }).winner,
        "operator choice",
      );

      const ownerToken = claim.ownerToken as string;
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_a_completed",
        speakerAContent: "A",
        speakerAUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_b_completed",
        speakerBContent: "B",
        speakerBUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "judge_completed",
        judgeResult,
        judgeUsage: usage,
      });
      const completed = first.complete({
        executionId: claim.execution.id,
        ownerToken,
        userId,
        providerId: "mock",
        sessionStatus: "running",
        winner: null,
        speakerAContent: "A",
        speakerBContent: "B",
        judgeResult,
        usage,
      });

      const counts = first.database
        .prepare(
          `SELECT
             (SELECT "currentRound" FROM "DebateSession" WHERE "id" = ?) AS currentRound,
             (SELECT COUNT(*) FROM "DebateRound" WHERE "sessionId" = ?) AS rounds,
             (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = ?) AS scores,
             (SELECT COUNT(*) FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1 AND "eventType" = 'debate_round') AS usage`,
        )
        .get(sessionId, sessionId, completed.roundId, sessionId) as {
        currentRound: number;
        rounds: number;
        scores: number;
        usage: number;
      };
      assert.equal(counts.currentRound, 1);
      assert.equal(counts.rounds, 1);
      assert.equal(counts.scores, 2);
      assert.equal(counts.usage, 1);
    }
  });

  it("fails closed when a partial round conflicts with later session progress", () => {
    for (const withHigherRound of [false, true]) {
      const sessionId = randomUUID();
      const userId = randomUUID();
      seedSession(first, sessionId, userId);
      insertLegacyRound(first, sessionId, 1, 0);
      if (withHigherRound) insertLegacyRound(first, sessionId, 2, 2);
      first.database
        .prepare(`UPDATE "DebateSession" SET "currentRound" = ?, "status" = 'running' WHERE "id" = ?`)
        .run(withHigherRound ? 1 : 2, sessionId);

      assert.throws(
        () =>
          first.claim({
            sessionId,
            roundNumber: 1,
            requestId: `request:partial-conflict-${withHigherRound ? "higher" : "ahead"}`,
          }),
        /Cannot safely recover partial round 1/,
      );
      const roundCount = first.database
        .prepare(`SELECT COUNT(*) AS count FROM "DebateRound" WHERE "sessionId" = ?`)
        .get(sessionId) as { count: number };
      assert.equal(roundCount.count, withHigherRound ? 2 : 1);
      const session = first.database
        .prepare(`SELECT "currentRound" FROM "DebateSession" WHERE "id" = ?`)
        .get(sessionId) as { currentRound: number };
      assert.equal(session.currentRound, withHigherRound ? 1 : 2);
    }
  });

  it("reconciles a legacy orphan round exactly once and pauses non-terminal sessions", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    const roundId = randomUUID();
    const now = new Date().toISOString();
    first.database
      .prepare(
        `INSERT INTO "DebateRound"
          ("id", "sessionId", "roundNumber", "speakerAContent", "speakerBContent", "judgeSummary", "judgeComment", "confidence", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
         VALUES (?, ?, 1, 'legacy A', 'legacy B', 'legacy summary', 'legacy comment', 0.8, 11, 7, 0.002, ?)`,
      )
      .run(roundId, sessionId, now);
    for (const side of ["A", "B"] as const) {
      first.database
        .prepare(
          `INSERT INTO "JudgeScore"
            ("id", "roundId", "side", "logic", "evidence", "rebuttal", "clarity", "personaFidelity", "total", "comment")
           VALUES (?, ?, ?, 18, 17, 16, 15, 14, 80, 'legacy score')`,
        )
        .run(randomUUID(), roundId, side);
    }

    const reconciled = first.claim({
      sessionId,
      roundNumber: 1,
      requestId: "request:legacy-orphan",
      userId,
      providerId: "mock",
    });
    assert.equal(reconciled.outcome, "completed");
    assert.equal(reconciled.execution.roundId, roundId);

    const session = first.database
      .prepare(`SELECT "currentRound", "status" FROM "DebateSession" WHERE "id" = ?`)
      .get(sessionId) as { currentRound: number; status: string };
    const usageCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1`)
      .get(sessionId) as { count: number };
    assert.equal(session.currentRound, 1);
    assert.equal(session.status, "paused");
    assert.equal(usageCount.count, 1);

    const replay = second.claim({
      sessionId,
      roundNumber: 1,
      requestId: "request:legacy-orphan-retry",
      userId,
      providerId: "mock",
    });
    assert.equal(replay.outcome, "completed");
    assert.equal(replay.execution.id, reconciled.execution.id);
    const replayUsageCount = first.database
      .prepare(`SELECT COUNT(*) AS count FROM "UsageEvent" WHERE "sessionId" = ? AND "roundNumber" = 1`)
      .get(sessionId) as { count: number };
    assert.equal(replayUsageCount.count, 1);
  });

  it("keeps an old idempotency key bound to its original round after later completion", () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);

    const completeRound = (roundNumber: number, requestId: string) => {
      const claim = first.claim({ sessionId, roundNumber, requestId });
      const ownerToken = claim.ownerToken as string;
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_a_completed",
        speakerAContent: `A${roundNumber}`,
        speakerAUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "speaker_b_completed",
        speakerBContent: `B${roundNumber}`,
        speakerBUsage: usage,
      });
      first.checkpoint({
        executionId: claim.execution.id,
        ownerToken,
        stage: "judge_completed",
        judgeResult: { ...judgeResult, round: roundNumber },
        judgeUsage: usage,
      });
      return first.complete({
        executionId: claim.execution.id,
        ownerToken,
        userId,
        providerId: "mock",
        sessionStatus: "running",
        winner: null,
        speakerAContent: `A${roundNumber}`,
        speakerBContent: `B${roundNumber}`,
        judgeResult: { ...judgeResult, round: roundNumber },
        usage,
      });
    };

    const firstRound = completeRound(1, "request:old-key-original");
    completeRound(2, "request:later-round");
    const replay = second.claim({
      sessionId,
      roundNumber: 3,
      requestId: "request:old-key-original",
    });
    assert.equal(replay.outcome, "completed");
    assert.equal(replay.execution.roundId, firstRound.roundId);
  });

  it("repairs an advanced partial head before the mock engine computes its next round", async () => {
    const sessionId = randomUUID();
    const userId = randomUUID();
    seedSession(first, sessionId, userId);
    insertLegacyRound(first, sessionId, 1, 0);
    first.database
      .prepare(`UPDATE "DebateSession" SET "currentRound" = 1, "status" = 'running' WHERE "id" = ?`)
      .run(sessionId);
    for (const [side, stance] of [
      ["A", "主张推进"],
      ["B", "主张限制"],
      ["Judge", "中立裁判"],
    ] as const) {
      first.database
        .prepare(
          `INSERT INTO "DebateParticipant"
            ("id", "sessionId", "side", "stance", "personaId", "modelProviderId", "modelName", "systemPrompt")
           VALUES (?, ?, ?, ?, NULL, 'mock', NULL, ?)`,
        )
        .run(randomUUID(), sessionId, side, stance, `${side} system prompt`);
    }

    defaultStoreCreated = true;
    const result = await runNextRoundExecution(sessionId, userId, { requestId: "request:engine-head-repair" });
    assert.equal(result.roundNumber, 1);
    assert.ok(result.roundId);
    assert.equal(result.session.currentRound, 1);
    assert.equal(result.session.rounds.length, 1);

    const counts = first.database
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM "DebateRound" WHERE "sessionId" = ?) AS rounds,
           (SELECT COUNT(*) FROM "DebateRound" WHERE "sessionId" = ? AND "roundNumber" = 2) AS roundTwo,
           (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = ?) AS scores,
           (SELECT COUNT(*) FROM "UsageEvent" WHERE "sessionId" = ? AND "eventType" = 'debate_round') AS usage`,
      )
      .get(sessionId, sessionId, result.roundId, sessionId) as {
      rounds: number;
      roundTwo: number;
      scores: number;
      usage: number;
    };
    assert.equal(counts.rounds, 1);
    assert.equal(counts.roundTwo, 0);
    assert.equal(counts.scores, 2);
    assert.equal(counts.usage, 1);
  });
});
