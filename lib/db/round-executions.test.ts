import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureDatabase } from "./prisma.ts";
import { RoundExecutionStore } from "./round-executions.ts";
import type { JudgeResult } from "../debate/types.ts";

const directory = mkdtempSync(join(tmpdir(), "debate-round-executions-"));
const databasePath = join(directory, "rounds.db");
process.env.DATABASE_URL = `file:${databasePath}`;

let first: RoundExecutionStore;
let second: RoundExecutionStore;

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

before(async () => {
  await ensureDatabase();
  first = new RoundExecutionStore(databasePath);
  second = new RoundExecutionStore(databasePath);
});

after(() => {
  first.close();
  second.close();
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
});
