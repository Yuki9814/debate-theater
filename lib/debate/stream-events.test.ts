import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildRoundCompletionEvents, debateStreamEventNames, sseEvent } from "./stream-events.ts";
import type { DebateSessionDTO } from "./types.ts";

const session: DebateSessionDTO = {
  id: "session-1",
  mode: "free",
  topic: "测试辩题",
  status: "running",
  maxRounds: 3,
  pauseEveryRounds: 1,
  lowScoreThreshold: 55,
  consecutiveLowLimit: 3,
  judgeConfidence: 0.75,
  outputMode: "theater",
  currentRound: 1,
  winner: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  participants: [],
  sourceCards: [],
  recapSummary: null,
  keyArguments: [],
  weaknesses: [],
  evidenceChain: [],
  personaDrift: [],
  factRisks: [],
  nextActions: [],
  exportAvailable: true,
  rounds: [
    {
      id: "round-1",
      roundNumber: 1,
      speakerAContent: "甲方内容",
      speakerBContent: "乙方内容",
      judgeSummary: "裁判摘要",
      judgeComment: null,
      confidence: 0.8,
      inputTokens: 10,
      outputTokens: 20,
      estimatedCostUsd: 0.01,
      createdAt: "2026-01-01T00:00:00.000Z",
      scores: [
        { id: "a", side: "A", logic: 20, evidence: 20, rebuttal: 15, clarity: 10, personaFidelity: 10, total: 75, comment: null },
        { id: "b", side: "B", logic: 21, evidence: 21, rebuttal: 16, clarity: 11, personaFidelity: 10, total: 79, comment: null },
      ],
    },
  ],
};

describe("debate stream events", () => {
  it("keeps the fixed public event names", () => {
    assert.deepEqual([...debateStreamEventNames], [
      "speaker-a-start",
      "speaker-a-complete",
      "speaker-b-complete",
      "judge-complete",
      "usage-delta",
      "session",
      "done",
    ]);
  });

  it("serializes valid SSE frames", () => {
    assert.equal(sseEvent("done", { ok: true }), 'event: done\ndata: {"ok":true}\n\n');
  });

  it("builds completion events from the latest round", () => {
    const events = buildRoundCompletionEvents(session, session.rounds[0]);
    assert.deepEqual(events.map((event) => event.name), [
      "speaker-a-complete",
      "speaker-b-complete",
      "judge-complete",
      "usage-delta",
      "session",
      "done",
    ]);
    assert.deepEqual(events[3].data, {
      round: 1,
      inputTokens: 10,
      outputTokens: 20,
      estimatedCostUsd: 0.01,
    });
  });
});
