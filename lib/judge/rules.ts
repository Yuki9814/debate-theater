import { clamp } from "../utils.ts";
import type { JudgeResult, ScoreBreakdown } from "../debate/types.ts";

export const judgeScoringRules = `
Score both sides from 0 to 100.
Dimensions: Logic 30, Evidence 25, Rebuttal 20, Clarity 15, Persona fidelity 10.
When persona mode is disabled, persona fidelity may be treated as full score.
Return only valid JSON with round, scores, summary, judge_comment, possible_loser, should_end, and confidence.
`;

export const judgeJsonShape = {
  round: 1,
  scores: {
    A: {
      logic: 0,
      evidence: 0,
      rebuttal: 0,
      clarity: 0,
      persona_fidelity: 0,
      total: 0,
    },
    B: {
      logic: 0,
      evidence: 0,
      rebuttal: 0,
      clarity: 0,
      persona_fidelity: 0,
      total: 0,
    },
  },
  summary: "",
  judge_comment: "",
  possible_loser: null,
  should_end: false,
  confidence: 0,
};

function normalizeScore(score: ScoreBreakdown): ScoreBreakdown {
  const logic = clamp(Math.round(Number(score.logic) || 0), 0, 30);
  const evidence = clamp(Math.round(Number(score.evidence) || 0), 0, 25);
  const rebuttal = clamp(Math.round(Number(score.rebuttal) || 0), 0, 20);
  const clarity = clamp(Math.round(Number(score.clarity) || 0), 0, 15);
  const personaFidelity = clamp(Math.round(Number(score.persona_fidelity) || 0), 0, 10);
  const total = clamp(
    Math.round(Number(score.total) || logic + evidence + rebuttal + clarity + personaFidelity),
    0,
    100,
  );

  return {
    logic,
    evidence,
    rebuttal,
    clarity,
    persona_fidelity: personaFidelity,
    total,
  };
}

export function normalizeJudgeResult(result: JudgeResult, round: number): JudgeResult {
  const a = normalizeScore(result.scores.A);
  const b = normalizeScore(result.scores.B);
  const possibleLoser =
    result.possible_loser === "A" || result.possible_loser === "B"
      ? result.possible_loser
      : null;

  return {
    round,
    scores: {
      A: a,
      B: b,
    },
    summary: result.summary || "Judge found both sides viable and requested another round.",
    judge_comment: result.judge_comment || "Continue with tighter evidence and clearer rebuttals.",
    possible_loser: possibleLoser,
    should_end: Boolean(result.should_end),
    confidence: clamp(Number(result.confidence) || 0, 0, 1),
  };
}

export function buildJudgePrompt(params: {
  topic: string;
  round: number;
  stanceA: string;
  stanceB: string;
  speakerAContent: string;
  speakerBContent: string;
  mode?: string;
  personaA?: string | null;
  personaB?: string | null;
  sourceCards?: Array<{ title: string; sourceName: string; summary: string; reliabilityNote: string }>;
}) {
  const personaRules =
    params.mode === "persona"
      ? `
Persona mode:
- A must stay faithful to ${params.personaA ?? "its selected persona"}.
- B must stay faithful to ${params.personaB ?? "its selected persona"}.
- Deduct persona_fidelity for era drift, modern omniscience, generic assistant tone, or values that contradict the preset.`
      : "";
  const researchRules =
    params.mode === "research"
      ? `
Research mode:
- Both sides share the same source pack.
- Deduct evidence points for unsupported factual claims, distorted source use, fake dates, or stale claims.
Source pack:
${(params.sourceCards ?? [])
  .map((card, index) => `${index + 1}. ${card.title} — ${card.sourceName}: ${card.summary} (${card.reliabilityNote})`)
  .join("\n")}`
      : "";

  return `${judgeScoringRules}
${personaRules}
${researchRules}

Topic: ${params.topic}
Round: ${params.round}
A stance: ${params.stanceA}
B stance: ${params.stanceB}
A speech: ${params.speakerAContent}
B speech: ${params.speakerBContent}

JSON shape:
${JSON.stringify(judgeJsonShape, null, 2)}`;
}
