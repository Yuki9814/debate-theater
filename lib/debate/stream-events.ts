import type { DebateRoundDTO, DebateSessionDTO } from "./types.ts";

export const debateStreamEventNames = [
  "speaker-a-start",
  "speaker-a-complete",
  "speaker-b-complete",
  "judge-complete",
  "usage-delta",
  "session",
  "done",
] as const;

export type DebateStreamEventName = (typeof debateStreamEventNames)[number];

export function sseEvent(name: DebateStreamEventName | "error", data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

function scoreFor(round: DebateRoundDTO, side: "A" | "B") {
  return round.scores.find((score) => score.side === side)?.total ?? 0;
}

export function buildRoundCompletionEvents(session: DebateSessionDTO, round: DebateRoundDTO | undefined) {
  if (!round) {
    return [
      { name: "session" as const, data: { session } },
      { name: "done" as const, data: { ok: true } },
    ];
  }

  return [
    {
      name: "speaker-a-complete" as const,
      data: {
        round: round.roundNumber,
        content: round.speakerAContent,
      },
    },
    {
      name: "speaker-b-complete" as const,
      data: {
        round: round.roundNumber,
        content: round.speakerBContent,
      },
    },
    {
      name: "judge-complete" as const,
      data: {
        round: round.roundNumber,
        summary: round.judgeSummary,
        scores: {
          A: scoreFor(round, "A"),
          B: scoreFor(round, "B"),
        },
        confidence: round.confidence,
      },
    },
    {
      name: "usage-delta" as const,
      data: {
        round: round.roundNumber,
        inputTokens: round.inputTokens ?? 0,
        outputTokens: round.outputTokens ?? 0,
        estimatedCostUsd: round.estimatedCostUsd ?? 0,
      },
    },
    { name: "session" as const, data: { session } },
    { name: "done" as const, data: { ok: true } },
  ];
}
