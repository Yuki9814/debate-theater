import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { JudgeResult } from "../debate/types.ts";
import { normalizeJudgeResult } from "./rules.ts";

describe("normalizeJudgeResult", () => {
  it("clamps score dimensions and confidence to valid judge bounds", () => {
    const result = normalizeJudgeResult(
      {
        round: 99,
        scores: {
          A: {
            logic: 40,
            evidence: -2,
            rebuttal: 99,
            clarity: 16,
            persona_fidelity: 12,
            total: 500,
          },
          B: {
            logic: 20,
            evidence: 20,
            rebuttal: 10,
            clarity: 10,
            persona_fidelity: 8,
            total: 68,
          },
        },
        summary: "",
        judge_comment: "",
        possible_loser: "C" as "A",
        should_end: true,
        confidence: 2,
      },
      3,
    );

    assert.equal(result.round, 3);
    assert.deepEqual(result.scores.A, {
      logic: 30,
      evidence: 0,
      rebuttal: 20,
      clarity: 15,
      persona_fidelity: 10,
      total: 100,
    });
    assert.equal(result.possible_loser, null);
    assert.equal(result.confidence, 1);
    assert.match(result.summary, /Judge/);
  });

  it("normalizes non-finite and non-numeric score fields to safe finite values", () => {
    const malformed = {
      round: 1,
      scores: {
        A: {
          logic: NaN,
          evidence: Infinity,
          rebuttal: -Infinity,
          clarity: undefined,
          persona_fidelity: null,
          total: "bad"
        },
        B: {
          logic: "20",
          evidence: 15,
          rebuttal: 10,
          clarity: 5,
          persona_fidelity: 5,
          total: NaN
        }
      },
      summary: "",
      judge_comment: "",
      possible_loser: null,
      should_end: false,
      confidence: NaN
    } as unknown as JudgeResult;

    const result = normalizeJudgeResult(malformed, 2);

    assert.deepEqual(result.scores.A, {
      logic: 0,
      evidence: 25,
      rebuttal: 0,
      clarity: 0,
      persona_fidelity: 0,
      total: 25
    });
    assert.deepEqual(result.scores.B, {
      logic: 20,
      evidence: 15,
      rebuttal: 10,
      clarity: 5,
      persona_fidelity: 5,
      total: 55
    });
    assert.equal(result.confidence, 0);
    assert.equal(result.round, 2);
  });
});
