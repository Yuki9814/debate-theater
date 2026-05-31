import type { DebateSessionDTO } from "./types.ts";
import { buildSessionRecap } from "./recap.ts";

type RawScore = {
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

type RawRound = {
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
  createdAt: Date;
  scores: RawScore[];
};

type RawParticipant = {
  id: string;
  side: string;
  stance: string;
  personaId: string | null;
  modelProviderId: string | null;
  modelName: string | null;
  systemPrompt: string;
};

type RawSourceCard = {
  id: string;
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
  citationCount: number;
  createdAt: Date;
};

type RawSession = {
  id: string;
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
  participants: RawParticipant[];
  rounds: RawRound[];
  sourceCards?: RawSourceCard[];
};

export function serializeSession(session: RawSession): DebateSessionDTO {
  const serialized = {
    ...session,
    mode: session.mode ?? "free",
    outputMode: session.outputMode ?? "theater",
    winner: session.winner ?? null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    rounds: session.rounds.map((round) => ({
      ...round,
      createdAt: round.createdAt.toISOString(),
    })),
    sourceCards: (session.sourceCards ?? []).map((card) => ({
      ...card,
      createdAt: card.createdAt.toISOString(),
    })),
  };
  return {
    ...serialized,
    ...buildSessionRecap(serialized),
  };
}
