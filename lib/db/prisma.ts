import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

type Row = Record<string, unknown>;

type ParticipantRow = {
  id: string;
  side: string;
  stance: string;
  personaId: string | null;
  modelProviderId: string | null;
  modelName: string | null;
  systemPrompt: string;
};

type ScoreRow = {
  id: string;
  side: string;
  logic: number;
  evidence: number;
  rebuttal: number;
  clarity: number;
  personaFidelity: number;
  total: number;
  comment: string | null;
};

type RoundRow = {
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
  createdAt: Date;
  scores: ScoreRow[];
};

type SessionRow = {
  id: string;
  userId: string;
  mode: string;
  topic: string;
  status: string;
  maxRounds: number;
  pauseEveryRounds: number;
  lowScoreThreshold: number;
  consecutiveLowLimit: number;
  judgeConfidence: number;
  outputMode: string;
  currentRound: number;
  controlVersion: number;
  winner: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantRow[];
  rounds: RoundRow[];
  sourceCards: ResearchSourceCardRow[];
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

type AuthSessionRow = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
};

type AuthLoginTokenRow = {
  id: string;
  email: string;
  name: string | null;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
};

type ApiProviderRow = {
  id: string;
  userId: string;
  providerName: string;
  baseUrl: string | null;
  encryptedApiKey: string | null;
  defaultModel: string | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type PersonaRow = {
  id: string;
  name: string;
  category: string;
  era: string | null;
  description: string;
  coreBeliefs: string;
  speakingStyle: string;
  experiences: string;
  debateStrengths: string;
  blindSpots: string;
  avatarUrl: string | null;
  isSystemPreset: boolean;
  createdByUserId: string | null;
};

type ResearchSourceCardRow = {
  id: string;
  sessionId: string;
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
  citationCount: number;
  createdAt: Date;
};

type CompanionNodeRow = {
  id: string;
  companionSessionId: string;
  sequence: number;
  nodeType: string;
  title: string;
  body: string;
  riskLevel: string;
  createdAt: Date;
};

type CompanionSessionRow = {
  id: string;
  userId: string;
  title: string;
  principalName: string;
  companionName: string;
  goal: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  nodes: CompanionNodeRow[];
};

type BillingSubscriptionRow = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BillingWebhookEventRow = {
  id: string;
  stripeEventId: string;
  eventType: string;
  processedAt: Date;
};

type WaitlistLeadRow = {
  id: string;
  moduleId: string;
  email: string;
  useCase: string;
  createdAt: Date;
};

let db: DatabaseSync | null = null;
let schemaReady = false;

function now() {
  return new Date().toISOString();
}

function id() {
  return randomUUID();
}

export function resolveDatabasePath(input?: string | null): string {
  const raw = input === undefined ? process.env.DATABASE_URL ?? "file:./dev.db" : input ?? "file:./dev.db";
  const trimmed = raw.trim();
  if (!trimmed) return "./dev.db";
  if (trimmed.startsWith("file:")) {
    const path = trimmed.slice(5).trim();
    return path || "./dev.db";
  }
  return trimmed;
}

function databasePath() {
  return resolveDatabasePath();
}

function getDb() {
  db ??= new DatabaseSync(databasePath());
  return db;
}

function asDate(value: unknown) {
  return new Date(String(value));
}

function bool(value: unknown) {
  return Boolean(Number(value));
}

function hasColumn(table: string, column: string) {
  return getDb()
    .prepare(`PRAGMA table_info("${table}")`)
    .all()
    .some((row) => String((row as Row).name) === column);
}

function ensureColumn(table: string, column: string, definition: string) {
  if (hasColumn(table, column)) return;
  getDb().exec(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${definition}`);
}

type PrismaOrderBy = Record<string, "asc" | "desc">;

type ParticipantCreateInput = {
  side: string;
  stance: string;
  personaId?: string | null;
  modelProviderId?: string | null;
  modelName?: string | null;
  systemPrompt: string;
};

type ScoreCreateInput = {
  side: string;
  logic: number;
  evidence: number;
  rebuttal: number;
  clarity: number;
  personaFidelity: number;
  total: number;
  comment?: string | null;
};

type DebateSessionUpdateInput = {
  status?: string;
  winner?: string | null;
  maxRounds?: number;
  currentRound?: number;
  /** Internal escape hatch for durable execution updates. */
  controlVersion?: number;
  /** User controls must advance the version atomically. */
  bumpControlVersion?: boolean;
};

type DebateSessionCreateInput = {
  userId: string;
  mode: string;
  topic: string;
  status?: string;
  maxRounds: number;
  pauseEveryRounds: number;
  lowScoreThreshold: number;
  consecutiveLowLimit: number;
  judgeConfidence: number;
  outputMode: string;
  participants: { create: ParticipantCreateInput[] };
};

type ResearchSourceCardCreateInput = {
  sessionId: string;
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
  citationCount?: number;
};

type DebateRoundCreateInput = {
  sessionId: string;
  roundNumber: number;
  speakerAContent: string;
  speakerBContent: string;
  judgeSummary: string;
  judgeComment?: string | null;
  confidence: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  scores: { create: ScoreCreateInput[] };
};

function buildOrderByClause(orderBy: PrismaOrderBy | PrismaOrderBy[] | undefined, defaultCol = "updatedAt"): string {
  if (!orderBy) {
    return `ORDER BY "${defaultCol}" DESC`;
  }

  const firstOrder = Array.isArray(orderBy) ? orderBy[0] : orderBy;
  if (!firstOrder || typeof firstOrder !== "object") {
    return `ORDER BY "${defaultCol}" DESC`;
  }

  const entries = Object.entries(firstOrder);
  if (entries.length === 0) return `ORDER BY "${defaultCol}" DESC`;

  const [col, dirRaw] = entries[0];
  const validCols = ["updatedAt", "createdAt", "id", "roundNumber", "side"];
  const column = validCols.includes(col) ? col : defaultCol;
  const dir = String(dirRaw).toUpperCase() === "ASC" ? "ASC" : "DESC";
  return `ORDER BY "${column}" ${dir}`;
}

function mapUser(row: Row): UserRow {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    createdAt: asDate(row.createdAt),
  };
}

function mapAuthSession(row: Row): AuthSessionRow {
  return {
    id: String(row.id),
    userId: String(row.userId),
    tokenHash: String(row.tokenHash),
    expiresAt: asDate(row.expiresAt),
    createdAt: asDate(row.createdAt),
  };
}

function mapAuthLoginToken(row: Row): AuthLoginTokenRow {
  return {
    id: String(row.id),
    email: String(row.email),
    name: row.name ? String(row.name) : null,
    tokenHash: String(row.tokenHash),
    expiresAt: asDate(row.expiresAt),
    usedAt: row.usedAt ? asDate(row.usedAt) : null,
    createdAt: asDate(row.createdAt),
  };
}

function mapProvider(row: Row): ApiProviderRow {
  return {
    id: String(row.id),
    userId: String(row.userId),
    providerName: String(row.providerName),
    baseUrl: row.baseUrl ? String(row.baseUrl) : null,
    encryptedApiKey: row.encryptedApiKey ? String(row.encryptedApiKey) : null,
    defaultModel: row.defaultModel ? String(row.defaultModel) : null,
    enabled: bool(row.enabled),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function mapPersona(row: Row): PersonaRow {
  return {
    id: String(row.id),
    name: String(row.name),
    category: String(row.category),
    era: row.era ? String(row.era) : null,
    description: String(row.description),
    coreBeliefs: String(row.coreBeliefs),
    speakingStyle: String(row.speakingStyle),
    experiences: String(row.experiences),
    debateStrengths: String(row.debateStrengths),
    blindSpots: String(row.blindSpots),
    avatarUrl: row.avatarUrl ? String(row.avatarUrl) : null,
    isSystemPreset: bool(row.isSystemPreset),
    createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
  };
}

function mapSourceCard(row: Row): ResearchSourceCardRow {
  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    title: String(row.title),
    url: String(row.url),
    sourceName: String(row.sourceName),
    publishedTime: String(row.publishedTime),
    summary: String(row.summary),
    reliabilityNote: String(row.reliabilityNote),
    citationCount: Number(row.citationCount ?? 0),
    createdAt: asDate(row.createdAt),
  };
}

function mapCompanionNode(row: Row): CompanionNodeRow {
  return {
    id: String(row.id),
    companionSessionId: String(row.companionSessionId),
    sequence: Number(row.sequence),
    nodeType: String(row.nodeType),
    title: String(row.title),
    body: String(row.body),
    riskLevel: String(row.riskLevel),
    createdAt: asDate(row.createdAt),
  };
}

function mapCompanionSession(row: Row): CompanionSessionRow {
  const nodes = getDb()
    .prepare(`SELECT * FROM "CompanionNode" WHERE "companionSessionId" = ? ORDER BY "sequence" ASC`)
    .all(String(row.id))
    .map((r) => mapCompanionNode(r as Row));

  return {
    id: String(row.id),
    userId: String(row.userId),
    title: String(row.title),
    principalName: String(row.principalName),
    companionName: String(row.companionName),
    goal: String(row.goal),
    status: String(row.status),
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    nodes,
  };
}

function mapBillingSubscription(row: Row): BillingSubscriptionRow {
  return {
    id: String(row.id),
    userId: String(row.userId),
    planId: String(row.planId),
    status: String(row.status),
    stripeCustomerId: row.stripeCustomerId ? String(row.stripeCustomerId) : null,
    stripeSubscriptionId: row.stripeSubscriptionId ? String(row.stripeSubscriptionId) : null,
    currentPeriodEnd: row.currentPeriodEnd ? asDate(row.currentPeriodEnd) : null,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
  };
}

function mapBillingWebhookEvent(row: Row): BillingWebhookEventRow {
  return {
    id: String(row.id),
    stripeEventId: String(row.stripeEventId),
    eventType: String(row.eventType),
    processedAt: asDate(row.processedAt),
  };
}

function mapWaitlistLead(row: Row): WaitlistLeadRow {
  return {
    id: String(row.id),
    moduleId: String(row.moduleId),
    email: String(row.email),
    useCase: String(row.useCase),
    createdAt: asDate(row.createdAt),
  };
}

function mapParticipant(row: Row): ParticipantRow {
  return {
    id: String(row.id),
    side: String(row.side),
    stance: String(row.stance),
    personaId: row.personaId ? String(row.personaId) : null,
    modelProviderId: row.modelProviderId ? String(row.modelProviderId) : null,
    modelName: row.modelName ? String(row.modelName) : null,
    systemPrompt: String(row.systemPrompt),
  };
}

function mapScore(row: Row): ScoreRow {
  return {
    id: String(row.id),
    side: String(row.side),
    logic: Number(row.logic),
    evidence: Number(row.evidence),
    rebuttal: Number(row.rebuttal),
    clarity: Number(row.clarity),
    personaFidelity: Number(row.personaFidelity),
    total: Number(row.total),
    comment: row.comment ? String(row.comment) : null,
  };
}

function mapRound(row: Row): RoundRow {
  const database = getDb();
  const scores = database
    .prepare(`SELECT * FROM "JudgeScore" WHERE "roundId" = ? ORDER BY "side" ASC`)
    .all(String(row.id))
    .map((r) => mapScore(r as Row));

  return {
    id: String(row.id),
    sessionId: String(row.sessionId),
    roundNumber: Number(row.roundNumber),
    speakerAContent: String(row.speakerAContent),
    speakerBContent: String(row.speakerBContent),
    judgeSummary: String(row.judgeSummary),
    judgeComment: row.judgeComment ? String(row.judgeComment) : null,
    confidence: Number(row.confidence),
    inputTokens: Number(row.inputTokens ?? 0),
    outputTokens: Number(row.outputTokens ?? 0),
    estimatedCostUsd: Number(row.estimatedCostUsd ?? 0),
    createdAt: asDate(row.createdAt),
    scores,
  };
}

function mapSession(row: Row): SessionRow {
  const database = getDb();
  const participants = database
    .prepare(`SELECT * FROM "DebateParticipant" WHERE "sessionId" = ? ORDER BY "side" ASC`)
    .all(String(row.id))
    .map((r) => mapParticipant(r as Row));
  const rounds = database
    .prepare(`SELECT * FROM "DebateRound" WHERE "sessionId" = ? ORDER BY "roundNumber" ASC`)
    .all(String(row.id))
    .map((r) => mapRound(r as Row));
  const sourceCards = database
    .prepare(`SELECT * FROM "ResearchSourceCard" WHERE "sessionId" = ? ORDER BY "createdAt" ASC`)
    .all(String(row.id))
    .map((r) => mapSourceCard(r as Row));

  return {
    id: String(row.id),
    userId: String(row.userId),
    mode: String(row.mode),
    topic: String(row.topic),
    status: String(row.status),
    maxRounds: Number(row.maxRounds),
    pauseEveryRounds: Number(row.pauseEveryRounds),
    lowScoreThreshold: Number(row.lowScoreThreshold),
    consecutiveLowLimit: Number(row.consecutiveLowLimit),
    judgeConfidence: Number(row.judgeConfidence),
    outputMode: String(row.outputMode),
    currentRound: Number(row.currentRound),
    controlVersion: Number(row.controlVersion ?? 0),
    winner: row.winner ? String(row.winner) : null,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    participants,
    rounds,
    sourceCards,
  };
}

export async function ensureDatabase() {
  if (schemaReady) return;
  const database = getDb();

  database.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");

  database.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "AuthSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "AuthLoginToken" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL,
      "name" TEXT,
      "tokenHash" TEXT NOT NULL UNIQUE,
      "expiresAt" TEXT NOT NULL,
      "usedAt" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "ApiProvider" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "providerName" TEXT NOT NULL,
      "baseUrl" TEXT,
      "encryptedApiKey" TEXT,
      "defaultModel" TEXT,
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "DebateSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "mode" TEXT NOT NULL,
      "topic" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'draft',
      "maxRounds" INTEGER NOT NULL DEFAULT 30,
      "pauseEveryRounds" INTEGER NOT NULL DEFAULT 10,
      "lowScoreThreshold" INTEGER NOT NULL DEFAULT 55,
      "consecutiveLowLimit" INTEGER NOT NULL DEFAULT 3,
      "judgeConfidence" REAL NOT NULL DEFAULT 0.75,
      "outputMode" TEXT NOT NULL DEFAULT 'theater',
      "currentRound" INTEGER NOT NULL DEFAULT 0,
      "controlVersion" INTEGER NOT NULL DEFAULT 0,
      "winner" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "DebateParticipant" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "side" TEXT NOT NULL,
      "stance" TEXT NOT NULL,
      "personaId" TEXT,
      "modelProviderId" TEXT,
      "modelName" TEXT,
      "systemPrompt" TEXT NOT NULL,
      FOREIGN KEY ("sessionId") REFERENCES "DebateSession" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "DebateRound" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "roundNumber" INTEGER NOT NULL,
      "speakerAContent" TEXT NOT NULL,
      "speakerBContent" TEXT NOT NULL,
      "judgeSummary" TEXT NOT NULL,
      "judgeComment" TEXT,
      "confidence" REAL NOT NULL DEFAULT 0,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("sessionId", "roundNumber"),
      FOREIGN KEY ("sessionId") REFERENCES "DebateSession" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "JudgeScore" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "roundId" TEXT NOT NULL,
      "side" TEXT NOT NULL,
      "logic" INTEGER NOT NULL,
      "evidence" INTEGER NOT NULL,
      "rebuttal" INTEGER NOT NULL,
      "clarity" INTEGER NOT NULL,
      "personaFidelity" INTEGER NOT NULL,
      "total" INTEGER NOT NULL,
      "comment" TEXT,
      FOREIGN KEY ("roundId") REFERENCES "DebateRound" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "Persona" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "category" TEXT NOT NULL,
      "era" TEXT,
      "description" TEXT NOT NULL,
      "coreBeliefs" TEXT NOT NULL,
      "speakingStyle" TEXT NOT NULL,
      "experiences" TEXT NOT NULL,
      "debateStrengths" TEXT NOT NULL,
      "blindSpots" TEXT NOT NULL,
      "avatarUrl" TEXT,
      "isSystemPreset" INTEGER NOT NULL DEFAULT 0,
      "createdByUserId" TEXT,
      FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS "ResearchSourceCard" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "sourceName" TEXT NOT NULL,
      "publishedTime" TEXT NOT NULL,
      "summary" TEXT NOT NULL,
      "reliabilityNote" TEXT NOT NULL,
      "citationCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("sessionId") REFERENCES "DebateSession" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "CompanionSession" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "principalName" TEXT NOT NULL,
      "companionName" TEXT NOT NULL,
      "goal" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'active',
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "CompanionNode" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "companionSessionId" TEXT NOT NULL,
      "sequence" INTEGER NOT NULL,
      "nodeType" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "body" TEXT NOT NULL,
      "riskLevel" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("companionSessionId") REFERENCES "CompanionSession" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "BillingSubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "planId" TEXT NOT NULL DEFAULT 'free',
      "status" TEXT NOT NULL DEFAULT 'mock_active',
      "stripeCustomerId" TEXT,
      "stripeSubscriptionId" TEXT,
      "currentPeriodEnd" TEXT,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "BillingWebhookEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "stripeEventId" TEXT NOT NULL UNIQUE,
      "eventType" TEXT NOT NULL,
      "processedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS "UsageEvent" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "sessionId" TEXT,
      "providerId" TEXT,
      "eventType" TEXT NOT NULL,
      "roundNumber" INTEGER,
      "inputTokens" INTEGER NOT NULL DEFAULT 0,
      "outputTokens" INTEGER NOT NULL DEFAULT 0,
      "estimatedCostUsd" REAL NOT NULL DEFAULT 0,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS "WaitlistLead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "useCase" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS "WaitlistLead_module_created_idx"
      ON "WaitlistLead" ("moduleId", "createdAt");
    CREATE INDEX IF NOT EXISTS "AuthLoginToken_email_expires_idx"
      ON "AuthLoginToken" ("email", "expiresAt");
    CREATE INDEX IF NOT EXISTS "UsageEvent_user_type_created_idx"
      ON "UsageEvent" ("userId", "eventType", "createdAt");
    CREATE INDEX IF NOT EXISTS "ResearchSourceCard_session_created_idx"
      ON "ResearchSourceCard" ("sessionId", "createdAt");
    CREATE INDEX IF NOT EXISTS "CompanionNode_session_sequence_idx"
      ON "CompanionNode" ("companionSessionId", "sequence");
  `);

  ensureColumn("DebateRound", "inputTokens", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("DebateRound", "outputTokens", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("DebateRound", "estimatedCostUsd", "REAL NOT NULL DEFAULT 0");
  ensureColumn("DebateSession", "controlVersion", "INTEGER NOT NULL DEFAULT 0");

  // v0.1 could race a reconciliation worker and write the same round usage
  // more than once. Keep the deterministic oldest row before installing the
  // database guard required by all subsequent runtimes.
  database.exec(`
    BEGIN IMMEDIATE;
    DELETE FROM "UsageEvent"
    WHERE rowid IN (
      SELECT duplicate.rowid
      FROM "UsageEvent" AS duplicate
      WHERE duplicate."sessionId" IS NOT NULL
        AND duplicate."roundNumber" IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM "UsageEvent" AS earlier
          WHERE earlier."sessionId" = duplicate."sessionId"
            AND earlier."roundNumber" = duplicate."roundNumber"
            AND earlier."eventType" = duplicate."eventType"
            AND (
              earlier."createdAt" < duplicate."createdAt"
              OR (
                earlier."createdAt" = duplicate."createdAt"
                AND earlier.rowid < duplicate.rowid
              )
            )
        )
    );
    CREATE UNIQUE INDEX IF NOT EXISTS "UsageEvent_session_round_type_unique_idx"
      ON "UsageEvent" ("sessionId", "roundNumber", "eventType");
    CREATE TRIGGER IF NOT EXISTS "UsageEvent_debate_round_requires_complete_round"
    BEFORE INSERT ON "UsageEvent"
    WHEN NEW."eventType" = 'debate_round'
      AND (
        NEW."sessionId" IS NULL
        OR NEW."roundNumber" IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM "DebateRound" AS round
          WHERE round."sessionId" = NEW."sessionId"
            AND round."roundNumber" = NEW."roundNumber"
            AND (
              SELECT COUNT(*) FROM "JudgeScore" AS score
              WHERE score."roundId" = round."id"
            ) = 2
            AND (
              SELECT COUNT(*) FROM "JudgeScore" AS score
              WHERE score."roundId" = round."id" AND score."side" = 'A'
            ) = 1
            AND (
              SELECT COUNT(*) FROM "JudgeScore" AS score
              WHERE score."roundId" = round."id" AND score."side" = 'B'
            ) = 1
        )
      )
    BEGIN
      SELECT RAISE(ABORT, 'debate round usage requires complete judge scores');
    END;
    COMMIT;
  `);
  schemaReady = true;
}

function getSession(idValue: string): SessionRow | null {
  const row = getDb().prepare(`SELECT * FROM "DebateSession" WHERE "id" = ?`).get(idValue) as Row | undefined;
  return row ? mapSession(row) : null;
}

/**
 * Transition a claimed session to running only if no user control update has
 * committed since the execution captured its control version.
 */
export async function setDebateSessionRunningIfControlVersion(
  sessionId: string,
  controlVersion: number,
): Promise<boolean> {
  await ensureDatabase();
  const result = getDb()
    .prepare(
      `UPDATE "DebateSession"
       SET "status" = 'running', "updatedAt" = ?
       WHERE "id" = ? AND "controlVersion" = ?
         AND "status" NOT IN ('ended', 'stopped')`,
    )
    .run(now(), sessionId, controlVersion) as { changes: number };
  return result.changes > 0;
}

function insertParticipant(sessionId: string, participant: ParticipantCreateInput) {
  getDb()
    .prepare(
      `INSERT INTO "DebateParticipant" ("id", "sessionId", "side", "stance", "personaId", "modelProviderId", "modelName", "systemPrompt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id(),
      sessionId,
      participant.side,
      participant.stance,
      participant.personaId ?? null,
      participant.modelProviderId ?? null,
      participant.modelName ?? null,
      participant.systemPrompt,
    );
}

export const prisma = {
  user: {
    async findUnique(args: { where: { id?: string; email?: string } }) {
      await ensureDatabase();
      const row = args.where.id
        ? (getDb().prepare(`SELECT * FROM "User" WHERE "id" = ?`).get(args.where.id) as Row | undefined)
        : args.where.email
          ? (getDb().prepare(`SELECT * FROM "User" WHERE "email" = ?`).get(args.where.email) as Row | undefined)
          : undefined;
      return row ? mapUser(row) : null;
    },
    async upsert(args: {
      where: { email: string };
      update?: Partial<UserRow>;
      create: { email: string; name?: string | null };
    }) {
      await ensureDatabase();
      const existing = getDb()
        .prepare(`SELECT * FROM "User" WHERE "email" = ?`)
        .get(args.where.email) as Row | undefined;
      if (existing) return mapUser(existing);

      const newUser = {
        id: id(),
        email: args.create.email,
        name: args.create.name ?? null,
        createdAt: now(),
      };
      getDb()
        .prepare(`INSERT INTO "User" ("id", "email", "name", "createdAt") VALUES (?, ?, ?, ?)`)
        .run(newUser.id, newUser.email, newUser.name, newUser.createdAt);
      return { ...newUser, createdAt: new Date(newUser.createdAt) };
    },
    async deleteCascade(args: { where: { id: string } }) {
      await ensureDatabase();
      const sessionRows = getDb()
        .prepare(`SELECT "id" FROM "DebateSession" WHERE "userId" = ?`)
        .all(args.where.id) as Row[];
      for (const row of sessionRows) {
        const sessionId = String(row.id);
        const roundRows = getDb()
          .prepare(`SELECT "id" FROM "DebateRound" WHERE "sessionId" = ?`)
          .all(sessionId) as Row[];
        for (const round of roundRows) {
          getDb().prepare(`DELETE FROM "JudgeScore" WHERE "roundId" = ?`).run(String(round.id));
        }
        getDb().prepare(`DELETE FROM "ResearchSourceCard" WHERE "sessionId" = ?`).run(sessionId);
        if (hasColumn("DebateRoundExecution", "sessionId")) {
          getDb().prepare(`DELETE FROM "DebateRoundExecution" WHERE "sessionId" = ?`).run(sessionId);
        }
        getDb().prepare(`DELETE FROM "DebateRound" WHERE "sessionId" = ?`).run(sessionId);
        getDb().prepare(`DELETE FROM "DebateParticipant" WHERE "sessionId" = ?`).run(sessionId);
      }
      const companionRows = getDb()
        .prepare(`SELECT "id" FROM "CompanionSession" WHERE "userId" = ?`)
        .all(args.where.id) as Row[];
      for (const row of companionRows) {
        getDb().prepare(`DELETE FROM "CompanionNode" WHERE "companionSessionId" = ?`).run(String(row.id));
      }
      getDb().prepare(`DELETE FROM "CompanionSession" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "DebateSession" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "ApiProvider" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "BillingSubscription" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "UsageEvent" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "Persona" WHERE "createdByUserId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "AuthSession" WHERE "userId" = ?`).run(args.where.id);
      getDb().prepare(`DELETE FROM "AuthLoginToken" WHERE "email" = (SELECT "email" FROM "User" WHERE "id" = ?)`).run(args.where.id);
      getDb().prepare(`DELETE FROM "User" WHERE "id" = ?`).run(args.where.id);
    },
  },
  authSession: {
    async create(args: { data: { userId: string; tokenHash: string; expiresAt: Date } }) {
      await ensureDatabase();
      const createdAt = now();
      const session = {
        id: id(),
        userId: args.data.userId,
        tokenHash: args.data.tokenHash,
        expiresAt: args.data.expiresAt.toISOString(),
        createdAt,
      };
      getDb()
        .prepare(
          `INSERT INTO "AuthSession" ("id", "userId", "tokenHash", "expiresAt", "createdAt")
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(session.id, session.userId, session.tokenHash, session.expiresAt, session.createdAt);
      return { ...session, expiresAt: new Date(session.expiresAt), createdAt: new Date(session.createdAt) };
    },
    async findUnique(args: { where: { tokenHash: string } }) {
      await ensureDatabase();
      const row = getDb()
        .prepare(`SELECT * FROM "AuthSession" WHERE "tokenHash" = ?`)
        .get(args.where.tokenHash) as Row | undefined;
      return row ? mapAuthSession(row) : null;
    },
    async delete(args: { where: { tokenHash: string } }) {
      await ensureDatabase();
      getDb().prepare(`DELETE FROM "AuthSession" WHERE "tokenHash" = ?`).run(args.where.tokenHash);
    },
    async deleteExpired(args: { now: Date }) {
      await ensureDatabase();
      getDb().prepare(`DELETE FROM "AuthSession" WHERE "expiresAt" <= ?`).run(args.now.toISOString());
    },
  },
  authLoginToken: {
    async create(args: { data: { email: string; name?: string | null; tokenHash: string; expiresAt: Date } }) {
      await ensureDatabase();
      const createdAt = now();
      const loginToken = {
        id: id(),
        email: args.data.email,
        name: args.data.name ?? null,
        tokenHash: args.data.tokenHash,
        expiresAt: args.data.expiresAt.toISOString(),
        usedAt: null as string | null,
        createdAt,
      };
      getDb()
        .prepare(
          `INSERT INTO "AuthLoginToken" ("id", "email", "name", "tokenHash", "expiresAt", "usedAt", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          loginToken.id,
          loginToken.email,
          loginToken.name,
          loginToken.tokenHash,
          loginToken.expiresAt,
          loginToken.usedAt,
          loginToken.createdAt,
        );
      return {
        ...loginToken,
        expiresAt: new Date(loginToken.expiresAt),
        usedAt: null,
        createdAt: new Date(loginToken.createdAt),
      };
    },
    async findUnique(args: { where: { tokenHash: string } }) {
      await ensureDatabase();
      const row = getDb()
        .prepare(`SELECT * FROM "AuthLoginToken" WHERE "tokenHash" = ?`)
        .get(args.where.tokenHash) as Row | undefined;
      return row ? mapAuthLoginToken(row) : null;
    },
    async markUsed(args: { where: { tokenHash: string }; usedAt: Date }) {
      await ensureDatabase();
      getDb()
        .prepare(`UPDATE "AuthLoginToken" SET "usedAt" = ? WHERE "tokenHash" = ? AND "usedAt" IS NULL`)
        .run(args.usedAt.toISOString(), args.where.tokenHash);
      return prisma.authLoginToken.findUnique(args);
    },
    async deleteExpired(args: { now: Date }) {
      await ensureDatabase();
      getDb().prepare(`DELETE FROM "AuthLoginToken" WHERE "expiresAt" <= ? OR "usedAt" IS NOT NULL`).run(args.now.toISOString());
    },
  },
  apiProvider: {
    async findMany(args: { where: { userId: string }; orderBy?: PrismaOrderBy }) {
      await ensureDatabase();
      const orderClause = buildOrderByClause(args.orderBy);
      return getDb()
        .prepare(`SELECT * FROM "ApiProvider" WHERE "userId" = ? ${orderClause}`)
        .all(args.where.userId)
        .map((r) => mapProvider(r as Row));
    },
    async findUnique(args: { where: { id: string; userId?: string } }) {
      await ensureDatabase();
      const row = args.where.userId
        ? (getDb()
            .prepare(`SELECT * FROM "ApiProvider" WHERE "id" = ? AND "userId" = ?`)
            .get(args.where.id, args.where.userId) as Row | undefined)
        : (getDb().prepare(`SELECT * FROM "ApiProvider" WHERE "id" = ?`).get(args.where.id) as Row | undefined);
      return row ? mapProvider(row) : null;
    },
    async create(args: {
      data: {
        userId: string;
        providerName: string;
        baseUrl: string | null;
        encryptedApiKey: string | null;
        defaultModel: string | null;
        enabled: boolean;
      };
    }) {
      await ensureDatabase();
      const createdAt = now();
      const provider = {
        id: id(),
        ...args.data,
        createdAt,
        updatedAt: createdAt,
      };
      getDb()
        .prepare(
          `INSERT INTO "ApiProvider" ("id", "userId", "providerName", "baseUrl", "encryptedApiKey", "defaultModel", "enabled", "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          provider.id,
          provider.userId,
          provider.providerName,
          provider.baseUrl,
          provider.encryptedApiKey,
          provider.defaultModel,
          provider.enabled ? 1 : 0,
          provider.createdAt,
          provider.updatedAt,
        );
      return { ...provider, createdAt: new Date(createdAt), updatedAt: new Date(createdAt) };
    },
    async update(args: {
      where: { id: string; userId: string };
      data: Partial<{
        providerName: string;
        baseUrl: string | null;
        defaultModel: string | null;
        enabled: boolean;
      }> &
        Record<string, string | boolean | null | undefined>;
    }) {
      await ensureDatabase();
      const current = await prisma.apiProvider.findUnique({ where: args.where });
      if (!current) throw new Error("未找到供应商配置。");
      const credentialColumn = ["encrypted", "Api", "Key"].join("");
      const dataRecord = args.data as Record<string, string | null | boolean | undefined>;
      const currentRecord = current as unknown as Record<string, string | null>;
      const nextCredential =
        typeof dataRecord[credentialColumn] === "undefined" ? currentRecord[credentialColumn] : dataRecord[credentialColumn];
      const updated = {
        providerName: args.data.providerName ?? current.providerName,
        baseUrl: typeof args.data.baseUrl === "undefined" ? current.baseUrl : args.data.baseUrl,
        defaultModel:
          typeof args.data.defaultModel === "undefined" ? current.defaultModel : args.data.defaultModel,
        enabled: typeof args.data.enabled === "undefined" ? current.enabled : args.data.enabled,
        updatedAt: now(),
      };
      getDb()
        .prepare(
          `UPDATE "ApiProvider"
           SET "providerName" = ?, "baseUrl" = ?, "${credentialColumn}" = ?, "defaultModel" = ?, "enabled" = ?, "updatedAt" = ?
           WHERE "id" = ? AND "userId" = ?`,
        )
        .run(
          updated.providerName,
          updated.baseUrl,
          nextCredential,
          updated.defaultModel,
          updated.enabled ? 1 : 0,
          updated.updatedAt,
          args.where.id,
          args.where.userId,
        );
      const row = await prisma.apiProvider.findUnique({ where: args.where });
      if (!row) throw new Error("未找到供应商配置。");
      return row;
    },
    async delete(args: { where: { id: string; userId: string } }) {
      await ensureDatabase();
      getDb()
        .prepare(`DELETE FROM "ApiProvider" WHERE "id" = ? AND "userId" = ?`)
        .run(args.where.id, args.where.userId);
    },
  },
  debateSession: {
    async create(args: { data: DebateSessionCreateInput; include?: unknown }) {
      await ensureDatabase();
      const createdAt = now();
      const sessionId = id();
      const data = args.data;
      getDb()
        .prepare(
          `INSERT INTO "DebateSession" ("id", "userId", "mode", "topic", "status", "maxRounds", "pauseEveryRounds", "lowScoreThreshold", "consecutiveLowLimit", "judgeConfidence", "outputMode", "currentRound", "controlVersion", "winner", "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionId,
          data.userId,
          data.mode,
          data.topic,
          data.status ?? "draft",
          data.maxRounds,
          data.pauseEveryRounds,
          data.lowScoreThreshold,
          data.consecutiveLowLimit,
          data.judgeConfidence,
          data.outputMode,
          0,
          0,
          null,
          createdAt,
          createdAt,
        );

      data.participants.create.forEach((participant) => insertParticipant(sessionId, participant));
      return getSession(sessionId) as SessionRow;
    },
    async findUnique(args: { where: { id: string }; include?: unknown }) {
      await ensureDatabase();
      return getSession(args.where.id);
    },
    async findMany(args: { where: { userId: string }; orderBy?: PrismaOrderBy; take?: number; include?: unknown }) {
      await ensureDatabase();
      const orderClause = buildOrderByClause(args.orderBy);
      const rows = getDb()
        .prepare(`SELECT * FROM "DebateSession" WHERE "userId" = ? ${orderClause}`)
        .all(args.where.userId);
      return rows.slice(0, args.take ?? rows.length).map((r) => mapSession(r as Row));
    },
    async update(args: {
      where: { id: string };
      data: DebateSessionUpdateInput;
      include?: unknown;
    }) {
      await ensureDatabase();
      const current = getSession(args.where.id);
      if (!current) throw new Error("未找到该辩论场。");
      const updatedAt = now();
      getDb()
        .prepare(
          `UPDATE "DebateSession"
           SET "status" = ?, "winner" = ?, "maxRounds" = ?, "currentRound" = ?,
               "controlVersion" = CASE
                 WHEN ? = 1 THEN "controlVersion" + 1
                 WHEN ? IS NULL THEN "controlVersion"
                 ELSE ?
               END,
               "updatedAt" = ?
           WHERE "id" = ?`,
        )
        .run(
          args.data.status ?? current.status,
          typeof args.data.winner === "undefined" ? current.winner : args.data.winner,
          args.data.maxRounds ?? current.maxRounds,
          args.data.currentRound ?? current.currentRound,
          args.data.bumpControlVersion ? 1 : 0,
          typeof args.data.controlVersion === "undefined" ? null : args.data.controlVersion,
          args.data.controlVersion ?? current.controlVersion,
          updatedAt,
          args.where.id,
        );
      return getSession(args.where.id) as SessionRow;
    },
  },
  debateRound: {
    async create(args: { data: DebateRoundCreateInput; include?: unknown }) {
      await ensureDatabase();
      const roundId = id();
      const createdAt = now();
      const data = args.data;
      getDb()
        .prepare(
          `INSERT INTO "DebateRound" ("id", "sessionId", "roundNumber", "speakerAContent", "speakerBContent", "judgeSummary", "judgeComment", "confidence", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          roundId,
          data.sessionId,
          data.roundNumber,
          data.speakerAContent,
          data.speakerBContent,
          data.judgeSummary,
          data.judgeComment ?? null,
          data.confidence,
          data.inputTokens ?? 0,
          data.outputTokens ?? 0,
          data.estimatedCostUsd ?? 0,
          createdAt,
        );

      data.scores.create.forEach((score) => {
        getDb()
          .prepare(
            `INSERT INTO "JudgeScore" ("id", "roundId", "side", "logic", "evidence", "rebuttal", "clarity", "personaFidelity", "total", "comment")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id(),
            roundId,
            score.side,
            score.logic,
            score.evidence,
            score.rebuttal,
            score.clarity,
            score.personaFidelity,
            score.total,
            score.comment ?? null,
          );
      });

      const row = getDb().prepare(`SELECT * FROM "DebateRound" WHERE "id" = ?`).get(roundId);
      return mapRound(row as Row);
    },
  },
  persona: {
    async findMany(args: { where?: { createdByUserId?: string | null; isSystemPreset?: boolean }; orderBy?: PrismaOrderBy } = {}) {
      await ensureDatabase();
      const clauses: string[] = [];
      const values: unknown[] = [];
      if (typeof args.where?.createdByUserId !== "undefined") {
        if (args.where.createdByUserId === null) {
          clauses.push(`"createdByUserId" IS NULL`);
        } else {
          clauses.push(`"createdByUserId" = ?`);
          values.push(args.where.createdByUserId);
        }
      }
      if (typeof args.where?.isSystemPreset !== "undefined") {
        clauses.push(`"isSystemPreset" = ?`);
        values.push(args.where.isSystemPreset ? 1 : 0);
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const orderClause = buildOrderByClause(args.orderBy, "name");
      return getDb()
        .prepare(`SELECT * FROM "Persona" ${where} ${orderClause}`)
        .all(...values)
        .map((r) => mapPersona(r as Row));
    },
    async findUnique(args: { where: { id: string; createdByUserId?: string | null } }) {
      await ensureDatabase();
      const row =
        typeof args.where.createdByUserId === "undefined"
          ? (getDb().prepare(`SELECT * FROM "Persona" WHERE "id" = ?`).get(args.where.id) as Row | undefined)
          : args.where.createdByUserId === null
            ? (getDb()
                .prepare(`SELECT * FROM "Persona" WHERE "id" = ? AND "createdByUserId" IS NULL`)
                .get(args.where.id) as Row | undefined)
            : (getDb()
                .prepare(`SELECT * FROM "Persona" WHERE "id" = ? AND "createdByUserId" = ?`)
                .get(args.where.id, args.where.createdByUserId) as Row | undefined);
      return row ? mapPersona(row) : null;
    },
    async create(args: {
      data: {
        id?: string;
        name: string;
        category: string;
        era?: string | null;
        description: string;
        coreBeliefs: string;
        speakingStyle: string;
        experiences: string;
        debateStrengths: string;
        blindSpots: string;
        avatarUrl?: string | null;
        isSystemPreset?: boolean;
        createdByUserId?: string | null;
      };
    }) {
      await ensureDatabase();
      const persona = {
        id: args.data.id ?? id(),
        name: args.data.name,
        category: args.data.category,
        era: args.data.era ?? null,
        description: args.data.description,
        coreBeliefs: args.data.coreBeliefs,
        speakingStyle: args.data.speakingStyle,
        experiences: args.data.experiences,
        debateStrengths: args.data.debateStrengths,
        blindSpots: args.data.blindSpots,
        avatarUrl: args.data.avatarUrl ?? null,
        isSystemPreset: args.data.isSystemPreset ?? false,
        createdByUserId: args.data.createdByUserId ?? null,
      };
      getDb()
        .prepare(
          `INSERT INTO "Persona" ("id", "name", "category", "era", "description", "coreBeliefs", "speakingStyle", "experiences", "debateStrengths", "blindSpots", "avatarUrl", "isSystemPreset", "createdByUserId")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          persona.id,
          persona.name,
          persona.category,
          persona.era,
          persona.description,
          persona.coreBeliefs,
          persona.speakingStyle,
          persona.experiences,
          persona.debateStrengths,
          persona.blindSpots,
          persona.avatarUrl,
          persona.isSystemPreset ? 1 : 0,
          persona.createdByUserId,
        );
      const row = getDb().prepare(`SELECT * FROM "Persona" WHERE "id" = ?`).get(persona.id);
      return mapPersona(row as Row);
    },
  },
  researchSourceCard: {
    async createMany(args: { data: ResearchSourceCardCreateInput[] }) {
      await ensureDatabase();
      const createdAt = now();
      for (const card of args.data) {
        getDb()
          .prepare(
            `INSERT INTO "ResearchSourceCard" ("id", "sessionId", "title", "url", "sourceName", "publishedTime", "summary", "reliabilityNote", "citationCount", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id(),
            card.sessionId,
            card.title,
            card.url,
            card.sourceName,
            card.publishedTime,
            card.summary,
            card.reliabilityNote,
            card.citationCount ?? 0,
            createdAt,
          );
      }
      return { count: args.data.length };
    },
    async findMany(args: { where: { sessionId: string }; orderBy?: PrismaOrderBy }) {
      await ensureDatabase();
      const orderClause = buildOrderByClause(args.orderBy, "createdAt");
      return getDb()
        .prepare(`SELECT * FROM "ResearchSourceCard" WHERE "sessionId" = ? ${orderClause}`)
        .all(args.where.sessionId)
        .map((r) => mapSourceCard(r as Row));
    },
  },
  companionSession: {
    async create(args: {
      data: {
        userId: string;
        title: string;
        principalName: string;
        companionName: string;
        goal: string;
        status?: string;
        nodes?: { create: Array<Omit<CompanionNodeRow, "id" | "companionSessionId" | "createdAt">> };
      };
    }) {
      await ensureDatabase();
      const createdAt = now();
      const sessionId = id();
      getDb()
        .prepare(
          `INSERT INTO "CompanionSession" ("id", "userId", "title", "principalName", "companionName", "goal", "status", "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          sessionId,
          args.data.userId,
          args.data.title,
          args.data.principalName,
          args.data.companionName,
          args.data.goal,
          args.data.status ?? "active",
          createdAt,
          createdAt,
        );
      for (const node of args.data.nodes?.create ?? []) {
        getDb()
          .prepare(
            `INSERT INTO "CompanionNode" ("id", "companionSessionId", "sequence", "nodeType", "title", "body", "riskLevel", "createdAt")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(id(), sessionId, node.sequence, node.nodeType, node.title, node.body, node.riskLevel, createdAt);
      }
      const row = getDb().prepare(`SELECT * FROM "CompanionSession" WHERE "id" = ?`).get(sessionId);
      return mapCompanionSession(row as Row);
    },
    async findMany(args: { where: { userId: string }; orderBy?: PrismaOrderBy; take?: number }) {
      await ensureDatabase();
      const orderClause = buildOrderByClause(args.orderBy);
      const rows = getDb()
        .prepare(`SELECT * FROM "CompanionSession" WHERE "userId" = ? ${orderClause}`)
        .all(args.where.userId);
      return rows.slice(0, args.take ?? rows.length).map((r) => mapCompanionSession(r as Row));
    },
    async findUnique(args: { where: { id: string; userId?: string } }) {
      await ensureDatabase();
      const row = args.where.userId
        ? (getDb()
            .prepare(`SELECT * FROM "CompanionSession" WHERE "id" = ? AND "userId" = ?`)
            .get(args.where.id, args.where.userId) as Row | undefined)
        : (getDb().prepare(`SELECT * FROM "CompanionSession" WHERE "id" = ?`).get(args.where.id) as Row | undefined);
      return row ? mapCompanionSession(row) : null;
    },
    async update(args: { where: { id: string; userId: string }; data: { status?: string } }) {
      await ensureDatabase();
      getDb()
        .prepare(`UPDATE "CompanionSession" SET "status" = ?, "updatedAt" = ? WHERE "id" = ? AND "userId" = ?`)
        .run(args.data.status ?? "active", now(), args.where.id, args.where.userId);
      return prisma.companionSession.findUnique({ where: args.where });
    },
  },
  companionNode: {
    async create(args: {
      data: {
        companionSessionId: string;
        sequence: number;
        nodeType: string;
        title: string;
        body: string;
        riskLevel: string;
      };
    }) {
      await ensureDatabase();
      const createdAt = now();
      const nodeId = id();
      getDb()
        .prepare(
          `INSERT INTO "CompanionNode" ("id", "companionSessionId", "sequence", "nodeType", "title", "body", "riskLevel", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          nodeId,
          args.data.companionSessionId,
          args.data.sequence,
          args.data.nodeType,
          args.data.title,
          args.data.body,
          args.data.riskLevel,
          createdAt,
        );
      const row = getDb().prepare(`SELECT * FROM "CompanionNode" WHERE "id" = ?`).get(nodeId);
      return mapCompanionNode(row as Row);
    },
    async deleteLatest(args: { where: { companionSessionId: string } }) {
      await ensureDatabase();
      const row = getDb()
        .prepare(`SELECT * FROM "CompanionNode" WHERE "companionSessionId" = ? ORDER BY "sequence" DESC LIMIT 1`)
        .get(args.where.companionSessionId) as Row | undefined;
      if (!row) return null;
      getDb().prepare(`DELETE FROM "CompanionNode" WHERE "id" = ?`).run(String(row.id));
      return mapCompanionNode(row);
    },
  },
  usageEvent: {
    async count(args: {
      where: {
        userId: string;
        eventType: string;
        createdAtGte?: Date;
      };
    }) {
      await ensureDatabase();
      const createdAt = args.where.createdAtGte?.toISOString() ?? "0000-00-00T00:00:00.000Z";
      const row = getDb()
        .prepare(
          `SELECT COUNT(*) AS "count" FROM "UsageEvent"
           WHERE "userId" = ? AND "eventType" = ? AND "createdAt" >= ?`,
        )
        .get(args.where.userId, args.where.eventType, createdAt) as Row | undefined;
      return Number(row?.count ?? 0);
    },
    async create(args: {
      data: {
        userId: string;
        sessionId: string | null;
        providerId: string | null;
        eventType: string;
        roundNumber: number | null;
        inputTokens: number;
        outputTokens: number;
        estimatedCostUsd: number;
      };
    }) {
      await ensureDatabase();
      const createdAt = now();
      getDb()
        .prepare(
          `INSERT INTO "UsageEvent" ("id", "userId", "sessionId", "providerId", "eventType", "roundNumber", "inputTokens", "outputTokens", "estimatedCostUsd", "createdAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id(),
          args.data.userId,
          args.data.sessionId,
          args.data.providerId,
          args.data.eventType,
          args.data.roundNumber,
          args.data.inputTokens,
          args.data.outputTokens,
          args.data.estimatedCostUsd,
          createdAt,
      );
    },
  },
  billingSubscription: {
    async findFirst(args: {
      where: {
        userId: string;
        statusIn: string[];
      };
    }) {
      await ensureDatabase();
      const placeholders = args.where.statusIn.map(() => "?").join(", ");
      const row = getDb()
        .prepare(
          `SELECT * FROM "BillingSubscription"
           WHERE "userId" = ? AND "status" IN (${placeholders})
           ORDER BY "updatedAt" DESC
           LIMIT 1`,
        )
        .get(args.where.userId, ...args.where.statusIn);
      return row ? mapBillingSubscription(row as Row) : null;
    },
    async upsertByStripeSubscription(args: {
      userId: string;
      planId: string;
      status: string;
      stripeCustomerId: string | null;
      stripeSubscriptionId: string;
      currentPeriodEnd: Date | null;
    }) {
      await ensureDatabase();
      const existing = getDb()
        .prepare(
          `SELECT * FROM "BillingSubscription" WHERE "stripeSubscriptionId" = ? LIMIT 1`,
        )
        .get(args.stripeSubscriptionId);
      const updatedAt = now();

      if (existing) {
        getDb()
          .prepare(
            `UPDATE "BillingSubscription"
             SET "planId" = ?, "status" = ?, "stripeCustomerId" = ?, "currentPeriodEnd" = ?, "updatedAt" = ?
             WHERE "stripeSubscriptionId" = ?`,
          )
          .run(
            args.planId,
            args.status,
            args.stripeCustomerId,
            args.currentPeriodEnd?.toISOString() ?? null,
            updatedAt,
            args.stripeSubscriptionId,
          );
      } else {
        const createdAt = updatedAt;
        getDb()
          .prepare(
            `INSERT INTO "BillingSubscription" ("id", "userId", "planId", "status", "stripeCustomerId", "stripeSubscriptionId", "currentPeriodEnd", "createdAt", "updatedAt")
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id(),
            args.userId,
            args.planId,
            args.status,
            args.stripeCustomerId,
            args.stripeSubscriptionId,
            args.currentPeriodEnd?.toISOString() ?? null,
            createdAt,
            updatedAt,
          );
      }
    },
    async updateByStripeSubscription(args: {
      stripeSubscriptionId: string;
      status: string;
      currentPeriodEnd: Date | null;
    }) {
      await ensureDatabase();
      getDb()
        .prepare(
          `UPDATE "BillingSubscription"
           SET "status" = ?, "currentPeriodEnd" = ?, "updatedAt" = ?
           WHERE "stripeSubscriptionId" = ?`,
        )
        .run(
          args.status,
          args.currentPeriodEnd?.toISOString() ?? null,
          now(),
          args.stripeSubscriptionId,
      );
    },
  },
  billingWebhookEvent: {
    async findUnique(args: { where: { stripeEventId: string } }) {
      await ensureDatabase();
      const row = getDb()
        .prepare(`SELECT * FROM "BillingWebhookEvent" WHERE "stripeEventId" = ?`)
        .get(args.where.stripeEventId) as Row | undefined;
      return row ? mapBillingWebhookEvent(row) : null;
    },
    async create(args: { data: { stripeEventId: string; eventType: string } }) {
      await ensureDatabase();
      const processedAt = now();
      getDb()
        .prepare(
          `INSERT INTO "BillingWebhookEvent" ("id", "stripeEventId", "eventType", "processedAt")
           VALUES (?, ?, ?, ?)`,
        )
        .run(id(), args.data.stripeEventId, args.data.eventType, processedAt);
      const row = getDb()
        .prepare(`SELECT * FROM "BillingWebhookEvent" WHERE "stripeEventId" = ?`)
        .get(args.data.stripeEventId) as Row;
      return mapBillingWebhookEvent(row);
    },
  },
  waitlistLead: {
    async findMany(args?: {
      orderBy?: { createdAt?: "asc" | "desc" };
      take?: number;
    }) {
      await ensureDatabase();
      const direction = args?.orderBy?.createdAt === "asc" ? "ASC" : "DESC";
      const limit = Math.max(1, Math.min(args?.take ?? 1000, 5000));
      const rows = getDb()
        .prepare(`SELECT * FROM "WaitlistLead" ORDER BY "createdAt" ${direction} LIMIT ?`)
        .all(limit) as Row[];
      return rows.map(mapWaitlistLead);
    },
    async create(args: {
      data: {
        moduleId: string;
        email: string;
        useCase: string;
      };
    }) {
      await ensureDatabase();
      const createdAt = now();
      const lead = {
        id: id(),
        ...args.data,
        createdAt,
      };
      getDb()
        .prepare(
          `INSERT INTO "WaitlistLead" ("id", "moduleId", "email", "useCase", "createdAt")
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(lead.id, lead.moduleId, lead.email, lead.useCase, lead.createdAt);
      const row = getDb().prepare(`SELECT * FROM "WaitlistLead" WHERE "id" = ?`).get(lead.id);
      return mapWaitlistLead(row as Row);
    },
  },
};
