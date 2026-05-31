import { createProvider } from "../ai/index.ts";
import { calculateUsage, aggregateUsage } from "../ai/usage.ts";
import { assertCanRunRound, recordRoundUsage } from "../billing/service.ts";
import { ensureDatabase, prisma } from "../db/prisma.ts";
import {
  type DebateRoundDTO,
  type DebateSetupInput,
  type JudgeResult,
  debateSetupSchema,
} from "./types.ts";
import { serializeSession } from "./serializers.ts";
import { buildJudgePrompt, normalizeJudgeResult } from "../judge/rules.ts";

// Module-scoped in-process guard to serialize round generation per session.
// Prevents duplicate AI provider calls and round INSERT races when a client
// issues concurrent "next round" requests (double-click, slow networks, tabs).
// Complements the client-side lockRef in debate-room.tsx. Low-risk addition
// that preserves all single-request behavior and existing state transitions.
const pendingRoundGenerations = new Set<string>();

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

function sidePrompt(side: "A" | "B", topic: string, stance: string, opponent: string) {
  return [
    `这里是论衡剧场，角色为${side === "A" ? "甲方" : "乙方"}辩手。`,
    `辩题：${topic}`,
    `本方立场：${stance}`,
    `对方立场：${opponent}`,
    "发言需逻辑清楚、反驳直接、证据简洁。",
  ].join("\n");
}

function judgePrompt(topic: string) {
  return [
    "这里是论衡剧场，角色为中立裁判。",
    `辩题：${topic}`,
    "必须只输出结构化 JSON。",
    "操作者权限高于裁判判定。",
  ].join("\n");
}

function chooseStances(input: DebateSetupInput) {
  if (input.mode === "custom" && input.sideA && input.sideB) {
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

export async function createDebateSession(rawInput: unknown) {
  const input = debateSetupSchema.parse(rawInput);
  const user = await ensureDemoUser();
  const stances = chooseStances(input);

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
            modelProviderId: input.providerA,
            modelName: input.modelA || null,
            systemPrompt: sidePrompt("A", input.topic, stances.A, stances.B),
          },
          {
            side: "B",
            stance: stances.B,
            modelProviderId: input.providerB,
            modelName: input.modelB || null,
            systemPrompt: sidePrompt("B", input.topic, stances.B, stances.A),
          },
          {
            side: "Judge",
            stance: "中立裁判",
            modelProviderId: input.providerJudge,
            modelName: input.modelJudge || null,
            systemPrompt: judgePrompt(input.topic),
          },
        ],
      },
    },
    include: sessionInclude,
  });

  return serializeSession(session);
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

export async function getSession(sessionId: string) {
  await ensureDatabase();
  const session = await prisma.debateSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });

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

  if (rounds.length >= params.maxRounds) {
    if (aAverage === bAverage) return { status: "ended", winner: "Draw" };
    return { status: "ended", winner: aAverage > bAverage ? "A" : "B" };
  }

  if (params.judgeResult.should_end || aCanLose || bCanLose) {
    return {
      status: "ended",
      winner: aCanLose ? "B" : bCanLose ? "A" : params.judgeResult.possible_loser === "A" ? "B" : "A",
    };
  }

  return { status: "running", winner: null };
}

async function getSpeakerContent(params: {
  side: "A" | "B";
  providerId: string | null;
  modelName: string | null;
  systemPrompt: string;
  userPrompt: string;
  topic: string;
  stance: string;
  opponentStance: string;
  round: number;
}) {
  const provider = createProvider({
    providerId: params.providerId,
    defaultModel: params.modelName,
  });
  const messages = [
    { role: "system" as const, content: params.systemPrompt },
    { role: "user" as const, content: params.userPrompt },
  ];
  const content = await provider.generateText({
    model: params.modelName,
    messages,
    metadata: {
      side: params.side,
      round: params.round,
      topic: params.topic,
      stance: params.stance,
      opponentStance: params.opponentStance,
    },
  });
  const usage = calculateUsage({
    providerId: params.providerId,
    messages,
    outputContent: content,
  });
  return { content, usage };
}

async function getJudgeEvaluation(params: {
  providerId: string | null;
  modelName: string | null;
  systemPrompt: string;
  topic: string;
  round: number;
  stanceA: string;
  stanceB: string;
  speakerAContent: string;
  speakerBContent: string;
}) {
  const provider = createProvider({
    providerId: params.providerId,
    defaultModel: params.modelName,
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
        speakerAContent: params.speakerAContent,
        speakerBContent: params.speakerBContent,
      }),
    },
  ];
  const rawResult = await provider.generateJSON<JudgeResult>({
    model: params.modelName,
    messages,
    metadata: { round: params.round, topic: params.topic },
  });
  const result = normalizeJudgeResult(rawResult, params.round);
  const usage = calculateUsage({
    providerId: params.providerId,
    messages,
    outputContent: JSON.stringify(result),
  });
  return { result, usage };
}

export async function runNextRound(sessionId: string) {
  await ensureDatabase();
  const session = await prisma.debateSession.findUnique({
    where: { id: sessionId },
    include: sessionInclude,
  });

  if (!session) throw new Error("未找到该辩论场。");
  if (session.status === "ended" || session.status === "stopped") {
    return serializeSession(session);
  }

  const participants = session.participants;
  const debaterA = participants.find((item) => item.side === "A");
  const debaterB = participants.find((item) => item.side === "B");
  const judge = participants.find((item) => item.side === "Judge");

  if (!debaterA || !debaterB || !judge) {
    throw new Error("辩论参与者配置不完整。");
  }

  const roundNumber = session.currentRound + 1;

  if (roundNumber > session.maxRounds) {
    const updated = await prisma.debateSession.update({
      where: { id: sessionId },
      data: { status: "ended", winner: "达到轮数上限" },
      include: sessionInclude,
    });
    return serializeSession(updated);
  }

  // Concurrency guard (see pendingRoundGenerations declaration above).
  // Only the first caller for this session proceeds past this point; others
  // short-circuit and return the latest persisted state. This eliminates
  // duplicate AI spend and the previous UNIQUE constraint 500s on races.
  if (pendingRoundGenerations.has(sessionId)) {
    const fresh = await getSession(sessionId);
    return fresh ?? serializeSession(session);
  }
  pendingRoundGenerations.add(sessionId);

  try {
    await assertCanRunRound(session.userId);

    // 1. Speaker A
    const { content: speakerAContent, usage: usageA } = await getSpeakerContent({
      side: "A",
      providerId: debaterA.modelProviderId,
      modelName: debaterA.modelName,
      systemPrompt: debaterA.systemPrompt,
      userPrompt: `第 ${roundNumber} 轮：先提出本方最强论点。`,
      topic: session.topic,
      stance: debaterA.stance,
      opponentStance: debaterB.stance,
      round: roundNumber,
    });

    // 2. Speaker B
    const { content: speakerBContent, usage: usageB } = await getSpeakerContent({
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
    });

    // 3. Judge
    const { result: judgeResult, usage: usageJudge } = await getJudgeEvaluation({
      providerId: judge.modelProviderId,
      modelName: judge.modelName,
      systemPrompt: judge.systemPrompt,
      topic: session.topic,
      round: roundNumber,
      stanceA: debaterA.stance,
      stanceB: debaterB.stance,
      speakerAContent,
      speakerBContent,
    });

    const totalUsage = aggregateUsage([usageA, usageB, usageJudge]);

    const createdRound = await prisma.debateRound.create({
      data: {
        sessionId,
        roundNumber,
        speakerAContent,
        speakerBContent,
        judgeSummary: judgeResult.summary,
        judgeComment: judgeResult.judge_comment,
        confidence: judgeResult.confidence,
        inputTokens: totalUsage.inputTokens,
        outputTokens: totalUsage.outputTokens,
        estimatedCostUsd: totalUsage.estimatedCostUsd,
        scores: {
          create: [
            {
              side: "A",
              logic: judgeResult.scores.A.logic,
              evidence: judgeResult.scores.A.evidence,
              rebuttal: judgeResult.scores.A.rebuttal,
              clarity: judgeResult.scores.A.clarity,
              personaFidelity: judgeResult.scores.A.persona_fidelity,
              total: judgeResult.scores.A.total,
              comment: judgeResult.summary,
            },
            {
              side: "B",
              logic: judgeResult.scores.B.logic,
              evidence: judgeResult.scores.B.evidence,
              rebuttal: judgeResult.scores.B.rebuttal,
              clarity: judgeResult.scores.B.clarity,
              personaFidelity: judgeResult.scores.B.persona_fidelity,
              total: judgeResult.scores.B.total,
              comment: judgeResult.summary,
            },
          ],
        },
      },
      include: {
        scores: {
          orderBy: { side: "asc" },
        },
      },
    });

    await recordRoundUsage({
      userId: session.userId,
      sessionId,
      providerId: "mixed",
      roundNumber,
      inputTokens: totalUsage.inputTokens,
      outputTokens: totalUsage.outputTokens,
      estimatedCostUsd: totalUsage.estimatedCostUsd,
    });

    const nextRounds = [
      ...serializeSession(session).rounds,
      {
        ...createdRound,
        createdAt: createdRound.createdAt.toISOString(),
      },
    ];

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

    const updated = await prisma.debateSession.update({
      where: { id: sessionId },
      data: {
        currentRound: roundNumber,
        status: shouldPause ? "awaiting_confirmation" : endState.status,
        winner: endState.winner,
      },
      include: sessionInclude,
    });

    return serializeSession(updated);
  } finally {
    pendingRoundGenerations.delete(sessionId);
  }
}


export async function updateSessionStatus(params: {
  sessionId: string;
  status?: string;
  winner?: string | null;
  maxRounds?: number;
}) {
  await ensureDatabase();
  const updated = await prisma.debateSession.update({
    where: { id: params.sessionId },
    data: {
      status: params.status,
      winner: params.winner,
      maxRounds: params.maxRounds,
    },
    include: sessionInclude,
  });

  return serializeSession(updated);
}
