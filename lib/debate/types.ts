import { z } from "zod";

export const debateStatuses = [
  "draft",
  "running",
  "paused",
  "awaiting_confirmation",
  "ended",
  "stopped",
] as const;

export type DebateStatus = (typeof debateStatuses)[number];

export const outputModes = ["full", "sentence", "theater"] as const;
export type OutputMode = (typeof outputModes)[number];

export const providerIds = ["mock", "openai", "custom-openai"] as const;
export type ProviderId = (typeof providerIds)[number];

export const debateSetupSchema = z.object({
  topic: z.string().trim().min(4, "请先输入辩题"),
  mode: z.enum(["auto", "custom"]).default("auto"),
  sideA: z.string().trim().optional(),
  sideB: z.string().trim().optional(),
  maxRounds: z.coerce.number().int().min(1).max(200).default(30),
  pauseEveryRounds: z.coerce.number().int().min(1).max(50).default(10),
  lowScoreThreshold: z.coerce.number().int().min(1).max(100).default(55),
  consecutiveLowLimit: z.coerce.number().int().min(1).max(20).default(3),
  judgeConfidence: z.coerce.number().min(0).max(1).default(0.75),
  outputMode: z.enum(outputModes).default("theater"),
  providerA: z.enum(providerIds).default("mock"),
  providerB: z.enum(providerIds).default("mock"),
  providerJudge: z.enum(providerIds).default("mock"),
  modelA: z.string().trim().optional(),
  modelB: z.string().trim().optional(),
  modelJudge: z.string().trim().optional(),
});

export type DebateSetupInput = z.infer<typeof debateSetupSchema>;

export function normalizeWinner(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export const sessionControlSchema = z.object({
  status: z.enum(debateStatuses).optional(),
  winner: z
    .string()
    .trim()
    .max(120)
    .nullable()
    .optional()
    .transform((value) => normalizeWinner(value)),
  maxRounds: z.coerce.number().int().min(1).max(200).optional(),
});

export type SessionControlInput = z.infer<typeof sessionControlSchema>;

export type ScoreBreakdown = {
  logic: number;
  evidence: number;
  rebuttal: number;
  clarity: number;
  persona_fidelity: number;
  total: number;
};

export type JudgeResult = {
  round: number;
  scores: {
    A: ScoreBreakdown;
    B: ScoreBreakdown;
  };
  summary: string;
  judge_comment: string;
  possible_loser: "A" | "B" | null;
  should_end: boolean;
  confidence: number;
};

export type ParticipantDTO = {
  id: string;
  side: "A" | "B" | "Judge" | string;
  stance: string;
  personaId: string | null;
  modelProviderId: string | null;
  modelName: string | null;
  systemPrompt: string;
};

export type JudgeScoreDTO = {
  id: string;
  side: "A" | "B" | string;
  logic: number;
  evidence: number;
  rebuttal: number;
  clarity: number;
  personaFidelity: number;
  total: number;
  comment: string | null;
};

export type DebateRoundDTO = {
  id: string;
  roundNumber: number;
  speakerAContent: string;
  speakerBContent: string;
  judgeSummary: string;
  judgeComment: string | null;
  confidence: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  createdAt: string;
  scores: JudgeScoreDTO[];
};

export type DebateSessionDTO = {
  id: string;
  mode: string;
  topic: string;
  status: DebateStatus | string;
  maxRounds: number;
  pauseEveryRounds: number;
  lowScoreThreshold: number;
  consecutiveLowLimit: number;
  judgeConfidence: number;
  outputMode: OutputMode | string;
  currentRound: number;
  winner: string | null;
  createdAt: string;
  updatedAt: string;
  participants: ParticipantDTO[];
  rounds: DebateRoundDTO[];
};

export const defaultDebateSetup: DebateSetupInput = {
  topic: "",
  mode: "auto",
  maxRounds: 30,
  pauseEveryRounds: 10,
  lowScoreThreshold: 55,
  consecutiveLowLimit: 3,
  judgeConfidence: 0.75,
  outputMode: "theater",
  providerA: "mock",
  providerB: "mock",
  providerJudge: "mock",
};

export const providerOptions: Array<{
  id: ProviderId;
  name: string;
  description: string;
}> = [
  {
    id: "mock",
    name: "本地模拟",
    description: "无需密钥，立即生成稳定的本地模拟回合。",
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "通过服务端 OPENAI_API_KEY 调用。",
  },
  {
    id: "custom-openai",
    name: "兼容 OpenAI",
    description: "服务端兼容接口预留。",
  },
];
