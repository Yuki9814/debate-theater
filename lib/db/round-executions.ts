import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { UsageResult } from "../ai/usage.ts";
import type { JudgeResult } from "../debate/types.ts";
import { resolveDatabasePath } from "./prisma.ts";

export const roundExecutionStages = [
  "claimed",
  "speaker_a_completed",
  "speaker_b_completed",
  "judge_completed",
  "completed",
  "failed",
] as const;

export type RoundExecutionStage = (typeof roundExecutionStages)[number];

export type RoundExecution = {
  id: string;
  sessionId: string;
  roundNumber: number;
  /** Snapshot of DebateSession.controlVersion captured at claim time. */
  controlVersion: number;
  primaryRequestId: string;
  status: RoundExecutionStage;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  speakerAContent: string | null;
  speakerAUsage: UsageResult | null;
  speakerBContent: string | null;
  speakerBUsage: UsageResult | null;
  judgeResult: JudgeResult | null;
  judgeUsage: UsageResult | null;
  roundId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type RoundExecutionClaim = {
  outcome: "claimed" | "resumed" | "in_progress" | "completed";
  execution: RoundExecution;
  ownerToken: string | null;
};

type Row = Record<string, unknown>;

type RoundCompletionInput = {
  executionId: string;
  ownerToken: string;
  userId: string;
  providerId: string;
  sessionStatus: string;
  winner: string | null;
  speakerAContent: string;
  speakerBContent: string;
  judgeResult: JudgeResult;
  usage: UsageResult;
};

type SessionState = {
  userId: string;
  currentRound: number;
  status: string;
  winner: string | null;
  controlVersion: number;
};

type ExistingRound = {
  id: string;
  sessionId: string;
  roundNumber: number;
  speakerAContent: string;
  speakerBContent: string;
  judgeSummary: string;
  judgeComment: string | null;
  confidence: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  createdAt: string;
  completeScores: boolean;
};

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

function parseJson<T>(value: unknown): T | null {
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function mapExecution(row: Row): RoundExecution {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    roundNumber: Number(row.roundNumber),
    controlVersion: Number(row.controlVersion ?? 0),
    primaryRequestId: String(row.primaryRequestId),
    status: String(row.status) as RoundExecutionStage,
    leaseOwner: row.leaseOwner ? String(row.leaseOwner) : null,
    leaseExpiresAt: row.leaseExpiresAt ? String(row.leaseExpiresAt) : null,
    speakerAContent: row.speakerAContent ? String(row.speakerAContent) : null,
    speakerAUsage: parseJson<UsageResult>(row.speakerAUsageJson),
    speakerBContent: row.speakerBContent ? String(row.speakerBContent) : null,
    speakerBUsage: parseJson<UsageResult>(row.speakerBUsageJson),
    judgeResult: parseJson<JudgeResult>(row.judgeResultJson),
    judgeUsage: parseJson<UsageResult>(row.judgeUsageJson),
    roundId: row.roundId ? String(row.roundId) : null,
    errorCode: row.errorCode ? String(row.errorCode) : null,
    errorMessage: row.errorMessage ? String(row.errorMessage) : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
    completedAt: row.completedAt ? String(row.completedAt) : null,
  };
}

function resumeStage(execution: RoundExecution): RoundExecutionStage {
  if (execution.judgeResult && execution.judgeUsage) return "judge_completed";
  if (execution.speakerBContent && execution.speakerBUsage) return "speaker_b_completed";
  if (execution.speakerAContent && execution.speakerAUsage) return "speaker_a_completed";
  return "claimed";
}

function stageRank(stage: RoundExecutionStage): number {
  if (stage === "claimed" || stage === "failed") return 0;
  if (stage === "speaker_a_completed") return 1;
  if (stage === "speaker_b_completed") return 2;
  if (stage === "judge_completed") return 3;
  return 4;
}

function assertRequestId(requestId: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(requestId)) {
    throw new Error("Invalid round idempotency key");
  }
}

export class RoundExecutionStore {
  readonly database: DatabaseSync;
  private readonly clock: () => number;
  private readonly leaseMs: number;

  constructor(path = resolveDatabasePath(), options?: { clock?: () => number; leaseMs?: number }) {
    this.database = new DatabaseSync(path);
    this.clock = options?.clock ?? Date.now;
    this.leaseMs = options?.leaseMs ?? DEFAULT_LEASE_MS;
    this.database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
    this.ensureSchema();
  }

  close(): void {
    (this.database as unknown as { close?: () => void }).close?.();
  }

  private ensureSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS "DebateRoundExecution" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "sessionId" TEXT NOT NULL,
        "roundNumber" INTEGER NOT NULL,
        "controlVersion" INTEGER NOT NULL DEFAULT 0,
        "primaryRequestId" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "leaseOwner" TEXT,
        "leaseExpiresAt" TEXT,
        "speakerAContent" TEXT,
        "speakerAUsageJson" TEXT,
        "speakerBContent" TEXT,
        "speakerBUsageJson" TEXT,
        "judgeResultJson" TEXT,
        "judgeUsageJson" TEXT,
        "roundId" TEXT,
        "errorCode" TEXT,
        "errorMessage" TEXT,
        "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TEXT,
        UNIQUE ("sessionId", "roundNumber"),
        FOREIGN KEY ("sessionId") REFERENCES "DebateSession" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("roundId") REFERENCES "DebateRound" ("id") ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS "DebateRoundRequest" (
        "executionId" TEXT NOT NULL,
        "sessionId" TEXT NOT NULL,
        "requestId" TEXT NOT NULL,
        "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY ("sessionId", "requestId"),
        FOREIGN KEY ("executionId") REFERENCES "DebateRoundExecution" ("id") ON DELETE CASCADE,
        FOREIGN KEY ("sessionId") REFERENCES "DebateSession" ("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "DebateRoundExecution_status_lease_idx"
        ON "DebateRoundExecution" ("status", "leaseExpiresAt");
      CREATE INDEX IF NOT EXISTS "DebateRoundRequest_execution_idx"
        ON "DebateRoundRequest" ("executionId");
      CREATE INDEX IF NOT EXISTS "DebateRoundExecution_roundId_idx"
        ON "DebateRoundExecution" ("roundId");
    `);
    this.ensureColumn("DebateRoundExecution", "controlVersion", "INTEGER NOT NULL DEFAULT 0");
    if (this.hasColumn("DebateSession", "id")) {
      this.ensureColumn("DebateSession", "controlVersion", "INTEGER NOT NULL DEFAULT 0");
    }
  }

  private hasColumn(table: string, column: string): boolean {
    return this.database
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .some((row) => String((row as Row).name) === column);
  }

  private ensureColumn(table: string, column: string, definition: string): void {
    if (!this.hasColumn(table, column)) {
      this.database.exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
    }
  }

  private transaction<T>(operation: () => T): T {
    this.database.exec("BEGIN IMMEDIATE");
    try {
      const result = operation();
      this.database.exec("COMMIT");
      return result;
    } catch (error) {
      try {
        this.database.exec("ROLLBACK");
      } catch {
        // Preserve the causal error if SQLite already rolled the transaction back.
      }
      throw error;
    }
  }

  private findById(executionId: string): RoundExecution | null {
    const row = this.database
      .prepare(`SELECT * FROM "DebateRoundExecution" WHERE "id" = ?`)
      .get(executionId) as Row | undefined;
    return row ? mapExecution(row) : null;
  }

  private findByRequest(sessionId: string, requestId: string): RoundExecution | null {
    const row = this.database
      .prepare(
        `SELECT execution.*
         FROM "DebateRoundRequest" request
         JOIN "DebateRoundExecution" execution ON execution."id" = request."executionId"
         WHERE request."sessionId" = ? AND request."requestId" = ?`,
      )
      .get(sessionId, requestId) as Row | undefined;
    return row ? mapExecution(row) : null;
  }

  private findByRound(sessionId: string, roundNumber: number): RoundExecution | null {
    const row = this.database
      .prepare(`SELECT * FROM "DebateRoundExecution" WHERE "sessionId" = ? AND "roundNumber" = ?`)
      .get(sessionId, roundNumber) as Row | undefined;
    return row ? mapExecution(row) : null;
  }

  private findSession(sessionId: string): SessionState | null {
    const row = this.database
      .prepare(
        `SELECT "userId", "currentRound", "status", "winner", "controlVersion"
         FROM "DebateSession" WHERE "id" = ?`,
      )
      .get(sessionId) as Row | undefined;
    if (!row) return null;
    return {
      userId: String(row.userId),
      currentRound: Number(row.currentRound),
      status: String(row.status),
      winner: row.winner ? String(row.winner) : null,
      controlVersion: Number(row.controlVersion ?? 0),
    };
  }

  private findExistingRound(sessionId: string, roundNumber: number): ExistingRound | null {
    const row = this.database
      .prepare(
        `SELECT "id", "sessionId", "roundNumber", "speakerAContent", "speakerBContent",
                "judgeSummary", "judgeComment", "confidence", "inputTokens",
                "outputTokens", "estimatedCostUsd", "createdAt",
                (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = "DebateRound"."id") AS "scoreCount",
                (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = "DebateRound"."id" AND "side" = 'A') AS "scoreACount",
                (SELECT COUNT(*) FROM "JudgeScore" WHERE "roundId" = "DebateRound"."id" AND "side" = 'B') AS "scoreBCount"
         FROM "DebateRound" WHERE "sessionId" = ? AND "roundNumber" = ?`,
      )
      .get(sessionId, roundNumber) as Row | undefined;
    if (!row) return null;
    return {
      id: String(row.id),
      sessionId: String(row.sessionId),
      roundNumber: Number(row.roundNumber),
      speakerAContent: String(row.speakerAContent),
      speakerBContent: String(row.speakerBContent),
      judgeSummary: String(row.judgeSummary),
      judgeComment: row.judgeComment ? String(row.judgeComment) : null,
      confidence: Number(row.confidence ?? 0),
      inputTokens: Number(row.inputTokens ?? 0),
      outputTokens: Number(row.outputTokens ?? 0),
      estimatedCostUsd: Number(row.estimatedCostUsd ?? 0),
      createdAt: String(row.createdAt),
      completeScores:
        Number(row.scoreCount ?? 0) === 2 &&
        Number(row.scoreACount ?? 0) === 1 &&
        Number(row.scoreBCount ?? 0) === 1,
    };
  }

  /**
   * Remove a round left halfway through the v0.1 write sequence. The caller
   * owns the BEGIN IMMEDIATE transaction, so a new worker cannot observe a
   * second partial state while this repair is in progress.
   */
  private discardIncompleteRound(round: ExistingRound): void {
    if (round.completeScores) return;
    this.database
      .prepare(
        `DELETE FROM "UsageEvent"
         WHERE "sessionId" = ? AND "roundNumber" = ? AND "eventType" = 'debate_round'`,
      )
      .run(round.sessionId, round.roundNumber);
    this.database.prepare(`DELETE FROM "JudgeScore" WHERE "roundId" = ?`).run(round.id);
    this.database
      .prepare(`DELETE FROM "DebateRound" WHERE "id" = ? AND "sessionId" = ? AND "roundNumber" = ?`)
      .run(round.id, round.sessionId, round.roundNumber);
  }

  private leaseIsActive(execution: RoundExecution, nowMs: number): boolean {
    return (
      execution.status !== "failed" &&
      execution.leaseExpiresAt !== null &&
      Number.isFinite(Date.parse(execution.leaseExpiresAt)) &&
      Date.parse(execution.leaseExpiresAt) > nowMs
    );
  }

  /**
   * Reconcile a round written by an older deployment (or by a worker that
   * crashed between the round insert and execution/session bookkeeping).
   * Existing round content is authoritative; all bookkeeping is idempotent.
   */
  private reconcileExistingRound(input: {
    execution: RoundExecution;
    round: ExistingRound;
    session: SessionState;
    userId?: string;
    providerId?: string;
    now: string;
  }): { roundId: string; completedAt: string } {
    const { execution, round, session, now } = input;
    if (!round.completeScores) {
      throw new Error("Cannot reconcile a debate round without exactly one A and one B judge score");
    }
    if (execution.roundId && execution.roundId !== round.id) {
      throw new Error("Round execution is bound to a different round");
    }

    this.database
      .prepare(
        `INSERT OR IGNORE INTO "UsageEvent"
          ("id", "userId", "sessionId", "providerId", "eventType", "roundNumber", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
         VALUES (?, ?, ?, ?, 'debate_round', ?, ?, ?, ?, ?)`,
      )
      .run(
        randomUUID(),
        input.userId ?? session.userId,
        execution.sessionId,
        input.providerId ?? "legacy-reconciliation",
        round.roundNumber,
        round.inputTokens,
        round.outputTokens,
        round.estimatedCostUsd,
        now,
      );

    const shouldAdvance = session.currentRound < round.roundNumber;
    const isTerminal = session.status === "ended" || session.status === "stopped";
    const nextStatus = shouldAdvance && !isTerminal ? "paused" : session.status;
    this.database
      .prepare(
        `UPDATE "DebateSession"
         SET "currentRound" = CASE WHEN "currentRound" < ? THEN ? ELSE "currentRound" END,
             "status" = ?, "updatedAt" = ?
         WHERE "id" = ?`,
      )
      .run(round.roundNumber, round.roundNumber, nextStatus, now, execution.sessionId);

    const completedAt = execution.completedAt ?? now;
    this.database
      .prepare(
        `UPDATE "DebateRoundExecution"
         SET "status" = 'completed', "roundId" = ?, "leaseOwner" = NULL,
             "leaseExpiresAt" = NULL, "errorCode" = NULL, "errorMessage" = NULL,
             "updatedAt" = ?, "completedAt" = ?
         WHERE "id" = ?`,
      )
      .run(round.id, now, completedAt, execution.id);

    return { roundId: round.id, completedAt };
  }

  private addRequestAlias(executionId: string, sessionId: string, requestId: string, createdAt: string): void {
    this.database
      .prepare(
        `INSERT OR IGNORE INTO "DebateRoundRequest" ("executionId", "sessionId", "requestId", "createdAt")
         VALUES (?, ?, ?, ?)`,
      )
      .run(executionId, sessionId, requestId, createdAt);
  }

  claim(input: {
    sessionId: string;
    roundNumber: number;
    requestId: string;
    userId?: string;
    providerId?: string;
  }): RoundExecutionClaim {
    assertRequestId(input.requestId);
    if (!Number.isSafeInteger(input.roundNumber) || input.roundNumber < 1) {
      throw new Error("Invalid round number");
    }

    return this.transaction(() => {
      const nowMs = this.clock();
      const now = new Date(nowMs).toISOString();
      const leaseExpiresAt = new Date(nowMs + this.leaseMs).toISOString();
      const ownerToken = randomUUID();
      const session = this.findSession(input.sessionId);
      if (!session) throw new Error("Debate session no longer exists");
      let execution =
        this.findByRequest(input.sessionId, input.requestId) ??
        this.findByRound(input.sessionId, input.roundNumber);

      let existingRound = this.findExistingRound(input.sessionId, input.roundNumber);
      if (existingRound && !existingRound.completeScores) {
        this.discardIncompleteRound(existingRound);
        // A rare rolling-deploy crash can leave a completed execution bound
        // to the now-discarded partial round. Turn it back into a durable
        // claim so this request follows the normal completion path.
        if (execution?.status === "completed") {
          this.database
            .prepare(
              `UPDATE "DebateRoundExecution"
               SET "status" = 'claimed', "roundId" = NULL, "controlVersion" = ?,
                   "leaseOwner" = ?, "leaseExpiresAt" = ?, "completedAt" = NULL,
                   "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = ?
               WHERE "id" = ? AND ("roundId" IS NULL OR "roundId" = ?)`,
            )
            .run(
              session.controlVersion,
              ownerToken,
              leaseExpiresAt,
              now,
              execution.id,
              existingRound.id,
            );
          execution = this.findById(execution.id);
        }
        existingRound = null;
      }

      if (!execution) {
        if (existingRound) {
          const executionId = randomUUID();
          this.database
            .prepare(
              `INSERT INTO "DebateRoundExecution"
                ("id", "sessionId", "roundNumber", "controlVersion", "primaryRequestId", "status", "roundId", "createdAt", "updatedAt", "completedAt")
               VALUES (?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`,
            )
            .run(
              executionId,
              input.sessionId,
              input.roundNumber,
              session.controlVersion,
              input.requestId,
              existingRound.id,
              now,
              now,
              existingRound.createdAt || now,
            );
          this.addRequestAlias(executionId, input.sessionId, input.requestId, now);
          const completedExecution = this.findById(executionId);
          if (!completedExecution) throw new Error("Failed to persist reconciled round execution");
          this.reconcileExistingRound({
            execution: completedExecution,
            round: existingRound,
            session,
            userId: input.userId,
            providerId: input.providerId,
            now,
          });
          const reconciledExecution = this.findById(executionId);
          if (!reconciledExecution) throw new Error("Failed to reload reconciled round execution");
          return { outcome: "completed", execution: reconciledExecution, ownerToken: null };
        }

        const executionId = randomUUID();
        this.database
          .prepare(
            `INSERT INTO "DebateRoundExecution"
              ("id", "sessionId", "roundNumber", "controlVersion", "primaryRequestId", "status", "leaseOwner", "leaseExpiresAt", "createdAt", "updatedAt")
             VALUES (?, ?, ?, ?, ?, 'claimed', ?, ?, ?, ?)`,
          )
          .run(
            executionId,
            input.sessionId,
            input.roundNumber,
            session.controlVersion,
            input.requestId,
            ownerToken,
            leaseExpiresAt,
            now,
            now,
          );
        this.addRequestAlias(executionId, input.sessionId, input.requestId, now);
        execution = this.findById(executionId);
        if (!execution) throw new Error("Failed to persist round execution claim");
        return { outcome: "claimed", execution, ownerToken };
      }

      this.addRequestAlias(execution.id, input.sessionId, input.requestId, now);
      if (existingRound && execution.roundNumber === input.roundNumber) {
        this.reconcileExistingRound({
          execution,
          round: existingRound,
          session,
          userId: input.userId,
          providerId: input.providerId,
          now,
        });
        const reconciledExecution = this.findById(execution.id);
        if (!reconciledExecution) throw new Error("Failed to reload reconciled round execution");
        return { outcome: "completed", execution: reconciledExecution, ownerToken: null };
      }
      if (execution.status === "completed") {
        return { outcome: "completed", execution, ownerToken: null };
      }

      const leaseActive = this.leaseIsActive(execution, nowMs);
      if (leaseActive) {
        return { outcome: "in_progress", execution, ownerToken: null };
      }

      const status = resumeStage(execution);
      this.database
        .prepare(
          `UPDATE "DebateRoundExecution"
           SET "status" = ?, "controlVersion" = ?, "leaseOwner" = ?, "leaseExpiresAt" = ?,
               "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = ?
           WHERE "id" = ?`,
        )
        .run(status, session.controlVersion, ownerToken, leaseExpiresAt, now, execution.id);
      execution = this.findById(execution.id);
      if (!execution) throw new Error("Failed to resume round execution claim");
      return { outcome: "resumed", execution, ownerToken };
    });
  }

  checkpoint(input: {
    executionId: string;
    ownerToken: string;
    stage: "speaker_a_completed" | "speaker_b_completed" | "judge_completed";
    speakerAContent?: string;
    speakerAUsage?: UsageResult;
    speakerBContent?: string;
    speakerBUsage?: UsageResult;
    judgeResult?: JudgeResult;
    judgeUsage?: UsageResult;
  }): RoundExecution {
    return this.transaction(() => {
      const nowMs = this.clock();
      const current = this.findById(input.executionId);
      if (!current || current.leaseOwner !== input.ownerToken || current.status === "completed" || !this.leaseIsActive(current, nowMs)) {
        throw new Error("Round execution lease is no longer owned by this request");
      }
      if (stageRank(input.stage) < stageRank(resumeStage(current))) {
        throw new Error("Round execution checkpoints cannot move backwards");
      }

      const now = new Date(nowMs).toISOString();
      const leaseExpiresAt = new Date(nowMs + this.leaseMs).toISOString();
      const result = this.database
        .prepare(
          `UPDATE "DebateRoundExecution"
           SET "status" = ?, "leaseExpiresAt" = ?,
               "speakerAContent" = COALESCE(?, "speakerAContent"),
               "speakerAUsageJson" = COALESCE(?, "speakerAUsageJson"),
               "speakerBContent" = COALESCE(?, "speakerBContent"),
               "speakerBUsageJson" = COALESCE(?, "speakerBUsageJson"),
               "judgeResultJson" = COALESCE(?, "judgeResultJson"),
               "judgeUsageJson" = COALESCE(?, "judgeUsageJson"),
               "updatedAt" = ?
           WHERE "id" = ? AND "leaseOwner" = ? AND "leaseExpiresAt" > ?`,
        )
        .run(
          input.stage,
          leaseExpiresAt,
          input.speakerAContent ?? null,
          input.speakerAUsage ? JSON.stringify(input.speakerAUsage) : null,
          input.speakerBContent ?? null,
          input.speakerBUsage ? JSON.stringify(input.speakerBUsage) : null,
          input.judgeResult ? JSON.stringify(input.judgeResult) : null,
          input.judgeUsage ? JSON.stringify(input.judgeUsage) : null,
          now,
          input.executionId,
          input.ownerToken,
          now,
        ) as { changes: number };
      if (result.changes === 0) {
        throw new Error("Round execution lease is no longer owned by this request");
      }
      const updated = this.findById(input.executionId);
      if (!updated) throw new Error("Round execution checkpoint was not persisted");
      return updated;
    });
  }

  fail(input: { executionId: string; ownerToken: string; errorCode: string; errorMessage: string }): void {
    this.transaction(() => {
      const nowMs = this.clock();
      const now = new Date(nowMs).toISOString();
      const result = this.database
        .prepare(
          `UPDATE "DebateRoundExecution"
           SET "status" = 'failed', "leaseOwner" = NULL, "leaseExpiresAt" = NULL,
               "errorCode" = ?, "errorMessage" = ?, "updatedAt" = ?
           WHERE "id" = ? AND "leaseOwner" = ? AND "status" != 'completed'
             AND "leaseExpiresAt" IS NOT NULL AND "leaseExpiresAt" > ?`,
        )
        .run(
          input.errorCode.slice(0, 80),
          input.errorMessage.slice(0, 240),
          now,
          input.executionId,
          input.ownerToken,
          now,
        ) as { changes: number };

      // A lease may have expired and been acquired by another process while the
      // original provider call was still running. Only the process that actually
      // released its own lease is allowed to pause the session.
      if (result.changes > 0) {
        const execution = this.findById(input.executionId);
        if (!execution) return;
        this.database
          .prepare(
            `UPDATE "DebateSession"
             SET "status" = 'paused', "updatedAt" = ?
             WHERE "id" = ? AND "status" = 'running' AND "currentRound" = ?
               AND "controlVersion" = ?`,
          )
          .run(now, execution.sessionId, execution.roundNumber - 1, execution.controlVersion);
      }
    });
  }

  complete(input: RoundCompletionInput): { roundId: string; completedAt: string } {
    return this.transaction(() => {
      const nowMs = this.clock();
      const now = new Date(nowMs).toISOString();
      let execution = this.findById(input.executionId);
      if (!execution) throw new Error("Round execution does not exist");

      const session = this.findSession(execution.sessionId);
      if (!session) throw new Error("Debate session no longer exists");

      // A previous deployment may have committed the round before it could
      // bind the execution or advance the session. Reconcile that durable
      // round before checking the current lease owner; this also repairs an
      // execution left active by a rolling deployment.
      const existingRound = this.findExistingRound(execution.sessionId, execution.roundNumber);
      if (existingRound) {
        if (existingRound.completeScores) {
          return this.reconcileExistingRound({
            execution,
            round: existingRound,
            session,
            userId: input.userId,
            providerId: input.providerId,
            now,
          });
        }
        this.discardIncompleteRound(existingRound);
        execution = this.findById(input.executionId);
        if (!execution) throw new Error("Round execution disappeared while recovering a partial round");
      }

      if (execution.status === "completed" && execution.roundId && execution.completedAt) {
        return { roundId: execution.roundId, completedAt: execution.completedAt };
      }
      if (
        execution.leaseOwner !== input.ownerToken ||
        !execution.judgeResult ||
        !execution.judgeUsage ||
        !this.leaseIsActive(execution, nowMs)
      ) {
        throw new Error("Round execution is not ready to complete");
      }

      const currentRound = session.currentRound;
      if (currentRound !== execution.roundNumber - 1) {
        throw new Error("Debate session round advanced outside the claimed execution");
      }

      const roundId = randomUUID();
      this.database
        .prepare(
          `INSERT INTO "DebateRound"
            ("id", "sessionId", "roundNumber", "speakerAContent", "speakerBContent", "judgeSummary", "judgeComment", "confidence", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          roundId,
          execution.sessionId,
          execution.roundNumber,
          input.speakerAContent,
          input.speakerBContent,
          input.judgeResult.summary,
          input.judgeResult.judge_comment,
          input.judgeResult.confidence,
          input.usage.inputTokens,
          input.usage.outputTokens,
          input.usage.estimatedCostUsd,
          now,
        );

      for (const side of ["A", "B"] as const) {
        const score = input.judgeResult.scores[side];
        this.database
          .prepare(
            `INSERT INTO "JudgeScore"
              ("id", "roundId", "side", "logic", "evidence", "rebuttal", "clarity", "personaFidelity", "total", "comment")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            randomUUID(),
            roundId,
            side,
            score.logic,
            score.evidence,
            score.rebuttal,
            score.clarity,
            score.persona_fidelity,
            score.total,
            input.judgeResult.summary,
          );
      }

      this.database
        .prepare(
          `INSERT OR IGNORE INTO "UsageEvent"
            ("id", "userId", "sessionId", "providerId", "eventType", "roundNumber", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
           VALUES (?, ?, ?, ?, 'debate_round', ?, ?, ?, ?, ?)`,
        )
        .run(
          randomUUID(),
          input.userId,
          execution.sessionId,
          input.providerId,
          execution.roundNumber,
          input.usage.inputTokens,
          input.usage.outputTokens,
          input.usage.estimatedCostUsd,
          now,
        );

      const controlUnchanged = session.controlVersion === execution.controlVersion;
      const sessionUpdate = controlUnchanged
        ? (this.database
            .prepare(
              `UPDATE "DebateSession"
               SET "currentRound" = ?, "status" = ?, "winner" = ?, "updatedAt" = ?
               WHERE "id" = ? AND "controlVersion" = ?`,
            )
            .run(
              execution.roundNumber,
              input.sessionStatus,
              input.winner,
              now,
              execution.sessionId,
              execution.controlVersion,
            ) as { changes: number })
        : (this.database
            .prepare(
              `UPDATE "DebateSession"
               SET "currentRound" = CASE WHEN "currentRound" < ? THEN ? ELSE "currentRound" END,
                   "updatedAt" = ?
               WHERE "id" = ?`,
            )
            .run(execution.roundNumber, execution.roundNumber, now, execution.sessionId) as { changes: number });
      if (sessionUpdate.changes === 0) {
        throw new Error("Debate session control changed while completing the round");
      }

      const executionUpdate = this.database
        .prepare(
          `UPDATE "DebateRoundExecution"
           SET "status" = 'completed', "roundId" = ?, "leaseOwner" = NULL,
               "leaseExpiresAt" = NULL, "errorCode" = NULL, "errorMessage" = NULL,
               "updatedAt" = ?, "completedAt" = ?
           WHERE "id" = ? AND "leaseOwner" = ? AND "leaseExpiresAt" > ?`,
        )
        .run(roundId, now, now, execution.id, input.ownerToken, now) as { changes: number };
      if (executionUpdate.changes === 0) {
        throw new Error("Round execution lease is no longer owned by this request");
      }

      return { roundId, completedAt: now };
    });
  }

  getByRequest(sessionId: string, requestId: string): RoundExecution | null {
    assertRequestId(requestId);
    return this.findByRequest(sessionId, requestId);
  }
}

let defaultStore: RoundExecutionStore | null = null;

export function roundExecutionStore(): RoundExecutionStore {
  defaultStore ??= new RoundExecutionStore();
  return defaultStore;
}
