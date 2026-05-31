import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { evaluateEndState } from "./engine.ts";
import type { DebateRoundDTO, JudgeResult } from "./types.ts";

function round(roundNumber: number, aTotal: number, bTotal: number): DebateRoundDTO {
  return {
    id: `round-${roundNumber}`,
    roundNumber,
    speakerAContent: "A",
    speakerBContent: "B",
    judgeSummary: "summary",
    judgeComment: null,
    confidence: 0.8,
    createdAt: new Date().toISOString(),
    scores: [
      {
        id: `a-${roundNumber}`,
        side: "A",
        logic: 10,
        evidence: 10,
        rebuttal: 10,
        clarity: 10,
        personaFidelity: 10,
        total: aTotal,
        comment: null,
      },
      {
        id: `b-${roundNumber}`,
        side: "B",
        logic: 10,
        evidence: 10,
        rebuttal: 10,
        clarity: 10,
        personaFidelity: 10,
        total: bTotal,
        comment: null,
      },
    ],
  };
}

const judgeResult: JudgeResult = {
  round: 3,
  scores: {
    A: { logic: 10, evidence: 10, rebuttal: 10, clarity: 10, persona_fidelity: 10, total: 50 },
    B: { logic: 20, evidence: 20, rebuttal: 15, clarity: 12, persona_fidelity: 10, total: 77 },
  },
  summary: "B leads",
  judge_comment: "A is below threshold",
  possible_loser: "A",
  should_end: false,
  confidence: 0.8,
};

describe("evaluateEndState", () => {
  it("ends when a side stays below threshold and the opponent leads by 10 average points", () => {
    const result = evaluateEndState({
      rounds: [round(1, 50, 66), round(2, 53, 70), round(3, 54, 74)],
      judgeResult,
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      maxRounds: 30,
    });

    assert.deepEqual(result, { status: "ended", winner: "B" });
  });

  it("pauses judge loss when confidence is below the configured threshold", () => {
    const result = evaluateEndState({
      rounds: [round(1, 50, 66), round(2, 53, 70), round(3, 54, 74)],
      judgeResult: { ...judgeResult, confidence: 0.7 },
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      maxRounds: 30,
    });

    assert.deepEqual(result, { status: "running", winner: null });
  });

  it("ends at maxRounds using average score (or draw)", () => {
    const result = evaluateEndState({
      rounds: [round(1, 60, 55), round(2, 62, 54)],
      judgeResult: { ...judgeResult, should_end: false, confidence: 0.9 },
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      maxRounds: 2,
    });
    assert.deepEqual(result, { status: "ended", winner: "A" });
  });

  it("ends immediately when judgeResult.should_end is true", () => {
    const result = evaluateEndState({
      rounds: [round(1, 70, 80)],
      judgeResult: { ...judgeResult, should_end: true, possible_loser: "A", confidence: 0.95 },
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      maxRounds: 30,
    });
    assert.deepEqual(result, { status: "ended", winner: "B" });
  });

  it("keeps running when no end conditions are met", () => {
    const result = evaluateEndState({
      rounds: [round(1, 80, 75), round(2, 78, 82)],
      judgeResult: { ...judgeResult, should_end: false, confidence: 0.6 },
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      maxRounds: 30,
    });
    assert.deepEqual(result, { status: "running", winner: null });
  });
});
