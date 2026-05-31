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
  winner: string | null;
  createdAt: Date;
  updatedAt: Date;
  participants: ParticipantRow[];
  rounds: RoundRow[];
};

type UserRow = {
  id: string;
  email: string;
  name: string | null;
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
    winner: row.winner ? String(row.winner) : null,
    createdAt: asDate(row.createdAt),
    updatedAt: asDate(row.updatedAt),
    participants,
    rounds,
  };
}

export async function ensureDatabase() {
  if (schemaReady) return;
  const database = getDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "email" TEXT NOT NULL UNIQUE,
      "name" TEXT,
      "createdAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "ApiProvider" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "providerName" TEXT NOT NULL,
      "baseUrl" TEXT,
      "encryptedApiKey" TEXT,
      "defaultModel" TEXT,
      "enabled" INTEGER NOT NULL DEFAULT 1,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
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
      "winner" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "DebateParticipant" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "sessionId" TEXT NOT NULL,
      "side" TEXT NOT NULL,
      "stance" TEXT NOT NULL,
      "personaId" TEXT,
      "modelProviderId" TEXT,
      "modelName" TEXT,
      "systemPrompt" TEXT NOT NULL
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
      "createdAt" TEXT NOT NULL,
      UNIQUE ("sessionId", "roundNumber")
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
      "comment" TEXT
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
      "createdByUserId" TEXT
    );
    CREATE TABLE IF NOT EXISTS "BillingSubscription" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "planId" TEXT NOT NULL DEFAULT 'free',
      "status" TEXT NOT NULL DEFAULT 'mock_active',
      "stripeCustomerId" TEXT,
      "stripeSubscriptionId" TEXT,
      "currentPeriodEnd" TEXT,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL
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
      "createdAt" TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS "WaitlistLead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "moduleId" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "useCase" TEXT NOT NULL,
      "createdAt" TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "WaitlistLead_module_created_idx"
      ON "WaitlistLead" ("moduleId", "createdAt");
    CREATE INDEX IF NOT EXISTS "UsageEvent_user_type_created_idx"
      ON "UsageEvent" ("userId", "eventType", "createdAt");
  `);

  ensureColumn("DebateRound", "inputTokens", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("DebateRound", "outputTokens", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("DebateRound", "estimatedCostUsd", "REAL NOT NULL DEFAULT 0");
  schemaReady = true;
}

function getSession(idValue: string): SessionRow | null {
  const row = getDb().prepare(`SELECT * FROM "DebateSession" WHERE "id" = ?`).get(idValue) as Row | undefined;
  return row ? mapSession(row) : null;
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
  },
  debateSession: {
    async create(args: { data: DebateSessionCreateInput; include?: unknown }) {
      await ensureDatabase();
      const createdAt = now();
      const sessionId = id();
      const data = args.data;
      getDb()
        .prepare(
          `INSERT INTO "DebateSession" ("id", "userId", "mode", "topic", "status", "maxRounds", "pauseEveryRounds", "lowScoreThreshold", "consecutiveLowLimit", "judgeConfidence", "outputMode", "currentRound", "winner", "createdAt", "updatedAt")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
           SET "status" = ?, "winner" = ?, "maxRounds" = ?, "currentRound" = ?, "updatedAt" = ?
           WHERE "id" = ?`,
        )
        .run(
          args.data.status ?? current.status,
          typeof args.data.winner === "undefined" ? current.winner : args.data.winner,
          args.data.maxRounds ?? current.maxRounds,
          args.data.currentRound ?? current.currentRound,
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
  waitlistLead: {
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
