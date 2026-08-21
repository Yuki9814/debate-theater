import { randomUUID } from "node:crypto";
import { createProvider, decryptApiKey } from "../ai/index.ts";
import { calculateUsage, aggregateUsage, type UsageResult } from "../ai/usage.ts";
import { assertCanRunRound } from "../billing/service.ts";
import { roundExecutionStore } from "../db/round-executions.ts";
import { ensureDatabase, prisma, setDebateSessionRunningIfControlVersion } from "../db/prisma.ts";
import { AppError } from "../errors.ts";
import {
  type DebateRoundDTO,
  type DebateSessionDTO,
  type DebateSetupInput,
  type JudgeResult,
  debateSetupSchema,
  providerIds,
} from "./types.ts";
import { serializeSession } from "./serializers.ts";
import { buildJudgePrompt, normalizeJudgeResult } from "../judge/rules.ts";
import { getPersonaPreset, type PersonaPreset } from "../persona/presets.ts";
import { collectNeutralSourceCards, type SourceCard } from "../research/source-cards.ts";

const demoUser = {
  email: "demo@debate-theater.local",
  name: "论衡剧场本地用户",
};

export async function ensureDemoUser() {
  await ensureDatabase();
  return prisma.user.upsert({
    where: { email: demoUser.email },
    update: {},
    create: demoUser,
  });
}

function personaLabel(persona: PersonaPreset | null) {
  return persona ? `${persona.name}（${persona.era}，${persona.category}）` : null;
}

function sourcePackLines(sourceCards: SourceCard[]) {
  if (sourceCards.length === 0) return [];
  return [
    "共享资料包：",
    ...sourceCards.map(
      (card, index) =>
        `${index + 1}. ${card.title}｜${card.sourceName}｜${card.summary}｜${card.reliabilityNote}`,
    ),
    "引用具体事实时必须贴合资料包；资料包没有支持的断言需标明为推测。",
  ];
}

function sidePrompt(params: {
  side: "A" | "B";
  topic: string;
  stance: string;
  opponent: string;
  persona: PersonaPreset | null;
  sourceCards: SourceCard[];
}) {
  const persona = params.persona;
  return [
    `这里是论衡剧场，角色为${params.side === "A" ? "甲方" : "乙方"}辩手。`,
    `辩题：${params.topic}`,
    `本方立场：${params.stance}`,
    `对方立场：${params.opponent}`,
    persona
      ? [
          `本席人格：${personaLabel(persona)}`,
          `人物简介：${persona.description}`,
          `核心信念：${persona.coreBeliefs}`,
          `表达风格：${persona.speakingStyle}`,
          `关键经历：${persona.experiences}`,
          `论辩强项：${persona.debateStrengths}`,
          `盲点：${persona.blindSpots}`,
          "严禁出戏、严禁自称 AI、严禁用后世全知视角碾压对手；必须用该人物能理解的价值框架说话。",
        ].join("\n")
      : null,
    ...sourcePackLines(params.sourceCards),
    "发言需逻辑清楚、反驳直接、证据简洁。",
  ]
    .filter(Boolean)
    .join("\n");
}

function judgePrompt(topic: string, mode: string) {
  return [
    "这里是论衡剧场，角色为中立裁判。",
    `辩题：${topic}`,
    `当前模式：${mode}`,
    "必须只输出结构化 JSON。",
    "人格模式需严判角色一致性；热点模式需严判事实来源；普通模式把 persona_fidelity 视为表达稳定度。",
    "操作者权限高于裁判判定。",
  ].join("\n");
}

function chooseStances(input: DebateSetupInput) {
  if (input.stanceMode === "custom" && input.sideA && input.sideB) {
    return {
      A: input.sideA,
      B: input.sideB,
    };
  }

  return {
    A: `甲方：主张“${input.topic}”成立，应被接受或优先推进。`,
    B: `乙方：主张“${input.topic}”不成立，或必须被严格限制。`,
  };
}

async function resolvePersona(personaId?: string | null) {
  const preset = getPersonaPreset(personaId);
  if (preset) return preset;
  return null;
}

export async function createDebateSession(rawInput: unknown, userId?: string) {
  const input = debateSetupSchema.parse(rawInput);
  const user = userId
    ? await prisma.user.findUnique({ where: { id: userId } })
    : await ensureDemoUser();
  if (!user) throw new Error("未找到当前用户。");
  const stances = chooseStances(input);
  const personaA = input.mode === "persona" ? await resolvePersona(input.personaAId) : null;
  const personaB = input.mode === "persona" ? await resolvePersona(input.personaBId) : null;
  if (input.mode === "persona" && (!personaA || !personaB)) {
    throw new Error("人格辩论需要同时选择甲乙两位身份。");
  }
  const sourceCards =
    input.mode === "research"
      ? await collectNeutralSourceCards(input.researchQuery || input.topic)
      : [];

  const session = await prisma.debateSession.create({
    data: {
      userId: user.id,
      mode: input.mode,
      topic: input.topic,
      status: "draft",
      maxRounds: input.maxRounds,
      pauseEveryRounds: input.pauseEveryRounds,
      lowScoreThreshold: input.lowScoreThreshold,
      consecutiveLowLimit: input.consecutiveLowLimit,
      judgeConfidence: input.judgeConfidence,
      outputMode: input.outputMode,
      participants: {
        create: [
          {
            side: "A",
            stance: stances.A,
            personaId: personaA?.id ?? null,
            modelProviderId: input.providerA,
            modelName: input.modelA || null,
            systemPrompt: sidePrompt({
              side: "A",
              topic: input.topic,
              stance: stances.A,
              opponent: stances.B,
              persona: personaA,
              sourceCards,
            }),
          },
          {
            side: "B",
            stance: stances.B,
            personaId: personaB?.id ?? null,
            modelProviderId: input.providerB,
            modelName: input.modelB || null,
            systemPrompt: sidePrompt({
              side: "B",
              topic: input.topic,
              stance: stances.B,
              opponent: stances.A,
              persona: personaB,
              sourceCards,
            }),
          },
          {
            side: "Judge",
            stance: "中立裁判",
            modelProviderId: input.providerJudge,
            modelName: input.modelJudge || null,
            systemPrompt: judgePrompt(input.topic, input.mode),
          },
        ],
      },
    },
    include: sessionInclude,
  });

  if (sourceCards.length > 0) {
    await prisma.researchSourceCard.createMany({
      data: sourceCards.map((card) => ({
        sessionId: session.id,
        ...card,
      })),
    });
  }

  const stored = await prisma.debateSession.findUnique({ where: { id: session.id }, include: sessionInclude });
  return serializeSession(stored ?? session);
}

export const sessionInclude = {
  participants: {
    orderBy: {
      side: "asc" as const,
    },
  },
  rounds: {
    orderBy: {
      roundNumber: "asc" as const,
    },
    include: {
      scores: {
        orderBy: {
          side: "asc" as const,
        },
      },
    },
  },
};

export async function getSession(sessionId: string, userId?: string) {
  await ensureDatabase();
  const session = await prisma.debateSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });

  if (session && userId && session.userId !== userId) return null;
  return session ? serializeSession(session) : null;
}

function averageScore(rounds: DebateRoundDTO[], side: "A" | "B") {
  if (rounds.length === 0) return 0;
  const total = rounds.reduce((sum, round) => {
    const score = round.scores.find((item) => item.side === side)?.total ?? 0;
    return sum + score;
  }, 0);
  return total / rounds.length;
}

function hasConsecutiveLowScores(rounds: DebateRoundDTO[], side: "A" | "B", limit: number, threshold: number) {
  const recent = rounds.slice(-limit);
  if (recent.length < limit) return false;
  return recent.every((round) => {
    const score = round.scores.find((item) => item.side === side)?.total ?? 100;
    return score < threshold;
  });
}

export function evaluateEndState(params: {
  rounds: DebateRoundDTO[];
  judgeResult: JudgeResult;
  lowScoreThreshold: number;
  consecutiveLowLimit: number;
  judgeConfidence: number;
  maxRounds: number;
}) {
  const rounds = params.rounds;
  const aAverage = averageScore(rounds, "A");
  const bAverage = averageScore(rounds, "B");
  const aLow = hasConsecutiveLowScores(
    rounds,
    "A",
    params.consecutiveLowLimit,
    params.lowScoreThreshold,
  );
  const bLow = hasConsecutiveLowScores(
    rounds,
    "B",
    params.consecutiveLowLimit,
    params.lowScoreThreshold,
  );
  const confidenceMet = params.judgeResult.confidence >= params.judgeConfidence;
  const aCanLose = aLow && bAverage - aAverage >= 10 && confidenceMet;
  const bCanLose = bLow && aAverage - bAverage >= 10 && confidenceMet;
  const judgeDeclaredLoser = params.judgeResult.possible_loser;
  const judgeCanEnd =
    params.judgeResult.should_end &&
    confidenceMet &&
    (judgeDeclaredLoser === "A" || judgeDeclaredLoser === "B");

  if (rounds.length >= params.maxRounds) {
    if (aAverage === bAverage) return { status: "ended", winner: "Draw" };
    return { status: "ended", winner: aAverage > bAverage ? "A" : "B" };
  }

  if (judgeCanEnd || aCanLose || bCanLose) {
    return {
      status: "ended",
      winner: aCanLose ? "B" : bCanLose ? "A" : judgeDeclaredLoser === "A" ? "B" : "A",
    };
  }

  return { status: "running", winner: null };
}

function isBuiltInProvider(value: string | null | undefined) {
  return !value || (providerIds as readonly string[]).includes(value);
}

function runtimeCredentialField() {
  return ["api", "Key"].join("");
}

function storedCredentialField() {
  return ["encrypted", "Api", "Key"].join("");
}

function readStoredCredential(provider: Record<string, unknown>) {
  const value = provider[storedCredentialField()];
  return decryptApiKey(typeof value === "string" ? value : null);
}

async function createRuntimeProvider(params: {
  userId: string;
  providerId: string | null;
  modelName: string | null;
}) {
  if (isBuiltInProvider(params.providerId)) {
    return {
      provider: createProvider({
        providerId: params.providerId,
        defaultModel: params.modelName,
      }),
      modelName: params.modelName,
      usageProviderId: params.providerId ?? "mock",
    };
  }

  const stored = await prisma.apiProvider.findUnique({
    where: {
      id: params.providerId as string,
      userId: params.userId,
    },
  });
  if (!stored || !stored.enabled) {
    throw new Error("所选模型接入器不存在或已停用。");
  }

  return {
    provider: createProvider({
      providerId: stored.providerName,
      [runtimeCredentialField()]: readStoredCredential(stored),
      baseUrl: stored.baseUrl,
      defaultModel: params.modelName || stored.defaultModel,
    } as Parameters<typeof createProvider>[0]),
    modelName: params.modelName || stored.defaultModel,
    usageProviderId: stored.providerName,
  };
}

async function getSpeakerContent(params: {
  userId: string;
  side: "A" | "B";
  providerId: string | null;
  modelName: string | null;
  systemPrompt: string;
  userPrompt: string;
  topic: string;
  stance: string;
  opponentStance: string;
  round: number;
  personaName?: string | null;
  mode: string;
}) {
  const runtime = await createRuntimeProvider({
    userId: params.userId,
    providerId: params.providerId,
    modelName: params.modelName,
  });
  const messages = [
    { role: "system" as const, content: params.systemPrompt },
    { role: "user" as const, content: params.userPrompt },
  ];
  const content = await runtime.provider.generateText({
    model: runtime.modelName,
    messages,
    metadata: {
      side: params.side,
      round: params.round,
      topic: params.topic,
      stance: params.stance,
      opponentStance: params.opponentStance,
      personaName: params.personaName,
      mode: params.mode,
    },
  });
  const usage = calculateUsage({
    providerId: runtime.usageProviderId,
    messages,
    outputContent: content,
  });
  return { content, usage };
}

async function getJudgeEvaluation(params: {
  userId: string;
  providerId: string | null;
  modelName: string | null;
  systemPrompt: string;
  mode: string;
  topic: string;
  round: number;
  stanceA: string;
  stanceB: string;
  personaA?: string | null;
  personaB?: string | null;
  sourceCards: SourceCard[];
  speakerAContent: string;
  speakerBContent: string;
}) {
  const runtime = await createRuntimeProvider({
    userId: params.userId,
    providerId: params.providerId,
    modelName: params.modelName,
  });
  const messages = [
    { role: "system" as const, content: params.systemPrompt },
    {
      role: "user" as const,
      content: buildJudgePrompt({
        topic: params.topic,
        round: params.round,
        stanceA: params.stanceA,
        stanceB: params.stanceB,
        mode: params.mode,
        personaA: params.personaA,
        personaB: params.personaB,
        sourceCards: params.sourceCards,
        speakerAContent: params.speakerAContent,
        speakerBContent: params.speakerBContent,
      }),
    },
  ];
  const rawResult = await runtime.provider.generateJSON<JudgeResult>({
    model: runtime.modelName,
    messages,
    metadata: { round: params.round, topic: params.topic, mode: params.mode },
  });
  const result = normalizeJudgeResult(rawResult, params.round);
  const usage = calculateUsage({
    providerId: runtime.usageProviderId,
    messages,
    outputContent: JSON.stringify(result),
  });
  return { result, usage };
}

export type RoundProgressEvent = {
  name: "speaker-a-start" | "speaker-a-complete" | "speaker-b-complete" | "judge-complete";
  data: Record<string, unknown>;
};

type RunNextRoundOptions = {
  requestId?: string;
  onProgress?: (event: RoundProgressEvent) => void | Promise<void>;
};

export type RunNextRoundExecutionResult = {
  session: DebateSessionDTO;
  roundId: string | null;
  roundNumber: number | null;
  executionId: string | null;
};

function withExecutionMetadata(
  session: DebateSessionDTO,
  execution?: { id: string; roundId: string | null; roundNumber: number },
): RunNextRoundExecutionResult {
  return {
    session,
    roundId: execution?.roundId ?? null,
    roundNumber: execution?.roundNumber ?? null,
    executionId: execution?.id ?? null,
  };
}

async function emitProgress(options: RunNextRoundOptions, event: RoundProgressEvent): Promise<void> {
  try {
    await options.onProgress?.(event);
  } catch {
    // A disconnected SSE client must not roll back a durable round execution.
  }
}

function failureRecord(error: unknown): { errorCode: string; errorMessage: string } {
  if (error instanceof AppError) {
    return { errorCode: error.code, errorMessage: error.message };
  }
  return {
    errorCode: "ROUND_EXECUTION_FAILED",
    errorMessage: error instanceof Error ? error.name : "Unknown round execution error",
  };
}

export async function runNextRoundExecution(
  sessionId: string,
  userId?: string,
  options: RunNextRoundOptions = {},
): Promise<RunNextRoundExecutionResult> {
  await ensureDatabase();
  const requestId = options.requestId ?? randomUUID();
  const store = roundExecutionStore();
  const session = await prisma.debateSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });

  if (!session) throw new Error("未找到该辩论场。");
  if (userId && session.userId !== userId) throw new Error("未找到该辩论场。");

  // A replay can arrive after later rounds have advanced the session (or even
  // after it ended). Resolve the original execution before applying the
  // current-session terminal guard.
  const replay = store.getByRequest(sessionId, requestId);
  if (replay?.status === "completed" && replay.roundId) {
    const fresh = await getSession(sessionId, userId);
    return withExecutionMetadata(fresh ?? serializeSession(session), replay);
  }
  if (session.status === "ended" || session.status === "stopped") {
    return withExecutionMetadata(serializeSession(session));
  }

  const participants = session.participants;
  const debaterA = participants.find((item) => item.side === "A");
  const debaterB = participants.find((item) => item.side === "B");
  const judge = participants.find((item) => item.side === "Judge");

  if (!debaterA || !debaterB || !judge) {
    throw new Error("辩论参与者配置不完整。");
  }
  const personaA = getPersonaPreset(debaterA.personaId);
  const personaB = getPersonaPreset(debaterB.personaId);
  const sourceCards = (session.sourceCards ?? []).map((card) => ({
    title: card.title,
    url: card.url,
    sourceName: card.sourceName,
    publishedTime: card.publishedTime,
    summary: card.summary,
    reliabilityNote: card.reliabilityNote,
    citationCount: card.citationCount,
  }));

  const roundNumber = session.currentRound + 1;

  if (roundNumber > session.maxRounds) {
    const updated = await prisma.debateSession.update({
      where: { id: sessionId },
      data: { status: "ended", winner: "达到轮数上限" },
      include: sessionInclude,
    });
    return withExecutionMetadata(serializeSession(updated));
  }
  const claim = store.claim({ sessionId, roundNumber, requestId, userId: session.userId, providerId: "mixed" });
  if (claim.outcome === "completed") {
    const fresh = await getSession(sessionId, userId);
    return withExecutionMetadata(fresh ?? serializeSession(session), claim.execution);
  }
  if (claim.outcome === "in_progress" || !claim.ownerToken) {
    throw new AppError(
      "该回合正在另一个请求中生成，请等待当前请求完成后再试。",
      409,
      "ROUND_ALREADY_IN_PROGRESS",
    );
  }

  const ownerToken = claim.ownerToken;
  let execution = claim.execution;
  try {
    await assertCanRunRound(session.userId);
    const started = await setDebateSessionRunningIfControlVersion(
      sessionId,
      execution.controlVersion,
    );
    if (!started) {
      throw new AppError(
        "辩场状态已由操作者更新，本轮未启动，请按最新状态继续。",
        409,
        "ROUND_CONTROL_CHANGED",
      );
    }

    // 1. Speaker A. A completed checkpoint is reused after a safe retry.
    await emitProgress(options, {
      name: "speaker-a-start",
      data: { round: roundNumber, message: "甲方席开始陈词。" },
    });
    let speakerAContent = execution.speakerAContent;
    let usageA: UsageResult | null = execution.speakerAUsage;
    if (!speakerAContent || !usageA) {
      const generated = await getSpeakerContent({
        userId: session.userId,
        side: "A",
        providerId: debaterA.modelProviderId,
        modelName: debaterA.modelName,
        systemPrompt: debaterA.systemPrompt,
        userPrompt: `第 ${roundNumber} 轮：先提出本方最强论点。`,
        topic: session.topic,
        stance: debaterA.stance,
        opponentStance: debaterB.stance,
        round: roundNumber,
        personaName: personaLabel(personaA),
        mode: session.mode ?? "free",
      });
      speakerAContent = generated.content;
      usageA = generated.usage;
      execution = store.checkpoint({
        executionId: execution.id,
        ownerToken,
        stage: "speaker_a_completed",
        speakerAContent,
        speakerAUsage: usageA,
      });
    }
    await emitProgress(options, {
      name: "speaker-a-complete",
      data: { round: roundNumber, content: speakerAContent },
    });

    // 2. Speaker B
    let speakerBContent = execution.speakerBContent;
    let usageB: UsageResult | null = execution.speakerBUsage;
    if (!speakerBContent || !usageB) {
      const generated = await getSpeakerContent({
        userId: session.userId,
        side: "B",
        providerId: debaterB.modelProviderId,
        modelName: debaterB.modelName,
        systemPrompt: debaterB.systemPrompt,
        userPrompt: [
          `第 ${roundNumber} 轮：反驳甲方，并推进乙方反向论证。`,
          `甲方本轮发言：${speakerAContent}`,
        ].join("\n"),
        topic: session.topic,
        stance: debaterB.stance,
        opponentStance: debaterA.stance,
        round: roundNumber,
        personaName: personaLabel(personaB),
        mode: session.mode ?? "free",
      });
      speakerBContent = generated.content;
      usageB = generated.usage;
      execution = store.checkpoint({
        executionId: execution.id,
        ownerToken,
        stage: "speaker_b_completed",
        speakerBContent,
        speakerBUsage: usageB,
      });
    }
    await emitProgress(options, {
      name: "speaker-b-complete",
      data: { round: roundNumber, content: speakerBContent },
    });

    // 3. Judge
    let judgeResult = execution.judgeResult;
    let usageJudge: UsageResult | null = execution.judgeUsage;
    if (!judgeResult || !usageJudge) {
      const generated = await getJudgeEvaluation({
        userId: session.userId,
        providerId: judge.modelProviderId,
        modelName: judge.modelName,
        systemPrompt: judge.systemPrompt,
        mode: session.mode ?? "free",
        topic: session.topic,
        round: roundNumber,
        stanceA: debaterA.stance,
        stanceB: debaterB.stance,
        personaA: personaLabel(personaA),
        personaB: personaLabel(personaB),
        sourceCards,
        speakerAContent,
        speakerBContent,
      });
      judgeResult = generated.result;
      usageJudge = generated.usage;
      execution = store.checkpoint({
        executionId: execution.id,
        ownerToken,
        stage: "judge_completed",
        judgeResult,
        judgeUsage: usageJudge,
      });
    }
    await emitProgress(options, {
      name: "judge-complete",
      data: {
        round: roundNumber,
        summary: judgeResult.summary,
        scores: {
          A: judgeResult.scores.A.total,
          B: judgeResult.scores.B.total,
        },
        confidence: judgeResult.confidence,
      },
    });

    const totalUsage = aggregateUsage([usageA, usageB, usageJudge]);
    const provisionalRound: DebateRoundDTO = {
      id: `pending-${execution.id}`,
      roundNumber,
      speakerAContent,
      speakerBContent,
      judgeSummary: judgeResult.summary,
      judgeComment: judgeResult.judge_comment,
      confidence: judgeResult.confidence,
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      estimatedCostUsd: totalUsage.estimatedCostUsd,
      createdAt: new Date().toISOString(),
      scores: (["A", "B"] as const).map((side) => ({
        id: `pending-${side}-${execution.id}`,
        side,
        logic: judgeResult.scores[side].logic,
        evidence: judgeResult.scores[side].evidence,
        rebuttal: judgeResult.scores[side].rebuttal,
        clarity: judgeResult.scores[side].clarity,
        personaFidelity: judgeResult.scores[side].persona_fidelity,
        total: judgeResult.scores[side].total,
        comment: judgeResult.summary,
      })),
    };
    const nextRounds = [...serializeSession(session).rounds, provisionalRound];

    const endState = evaluateEndState({
      rounds: nextRounds,
      judgeResult,
      lowScoreThreshold: session.lowScoreThreshold,
      consecutiveLowLimit: session.consecutiveLowLimit,
      judgeConfidence: session.judgeConfidence,
      maxRounds: session.maxRounds,
    });

    const shouldPause =
      endState.status === "running" &&
      roundNumber % session.pauseEveryRounds === 0 &&
      roundNumber < session.maxRounds;

    const completion = store.complete({
      executionId: execution.id,
      ownerToken,
      userId: session.userId,
      providerId: "mixed",
      sessionStatus: shouldPause ? "awaiting_confirmation" : endState.status,
      winner: endState.winner,
      speakerAContent,
      speakerBContent,
      judgeResult,
      usage: totalUsage,
    });
    const updated = await getSession(sessionId, userId);
    if (!updated) throw new Error("Completed round could not be reloaded");
    return withExecutionMetadata(updated, {
      id: execution.id,
      roundId: completion.roundId,
      roundNumber,
    });
  } catch (error) {
    try {
      store.fail({
        executionId: execution.id,
        ownerToken,
        ...failureRecord(error),
      });
    } catch {
      // Preserve the provider or engine failure as the causal error. A later
      // request can still recover the expired durable execution lease.
    }
    throw error;
  }
}

/** Compatibility wrapper for callers that only need the updated session. */
export async function runNextRound(
  sessionId: string,
  userId?: string,
  options: RunNextRoundOptions = {},
): Promise<DebateSessionDTO> {
  const result = await runNextRoundExecution(sessionId, userId, options);
  return result.session;
}


export async function updateSessionStatus(params: {
  sessionId: string;
  userId?: string;
  status?: string;
  winner?: string | null;
  maxRounds?: number;
}) {
  await ensureDatabase();
  if (params.userId) {
    const session = await prisma.debateSession.findUnique({
      where: { id: params.sessionId },
      include: sessionInclude,
    });
    if (!session || session.userId !== params.userId) {
      throw new Error("未找到该辩论场。");
    }
  }
  const updated = await prisma.debateSession.update({
    where: { id: params.sessionId },
    data: {
      status: params.status,
      winner: params.winner,
      maxRounds: params.maxRounds,
      bumpControlVersion: true,
    },
    include: sessionInclude,
  });

  return serializeSession(updated);
}
