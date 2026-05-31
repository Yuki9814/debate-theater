import type { DebateRoundDTO, DebateSessionDTO, JudgeScoreDTO, ParticipantDTO } from "./types.ts";

function scoreFor(round: DebateRoundDTO | undefined, side: "A" | "B") {
  return round?.scores.find((score) => score.side === side)?.total ?? 0;
}

function averageFor(rounds: DebateRoundDTO[], side: "A" | "B") {
  if (rounds.length === 0) return 0;
  return Math.round(rounds.reduce((sum, round) => sum + scoreFor(round, side), 0) / rounds.length);
}

function winnerLabel(winner: string | null, aAverage: number, bAverage: number) {
  if (winner === "A") return "甲方";
  if (winner === "B") return "乙方";
  if (winner === "Draw") return "双方平局";
  if (aAverage === bAverage) return "暂未分出明显胜负";
  return aAverage > bAverage ? "甲方暂时领先" : "乙方暂时领先";
}

function compact(text: string, max = 96) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function participant(participants: ParticipantDTO[], side: "A" | "B") {
  return participants.find((item) => item.side === side);
}

function weakestDimension(score: JudgeScoreDTO | undefined) {
  if (!score) return "暂无评分维度";
  const dimensions = [
    ["逻辑", score.logic],
    ["论据", score.evidence],
    ["反驳", score.rebuttal],
    ["表达", score.clarity],
    ["角色一致性", score.personaFidelity],
  ] as const;
  return dimensions.slice().sort((a, b) => a[1] - b[1])[0][0];
}

export function buildSessionRecap(session: {
  topic: string;
  status: string;
  mode?: string;
  winner: string | null;
  participants: ParticipantDTO[];
  rounds: DebateRoundDTO[];
  sourceCards?: Array<{ title: string; sourceName: string; reliabilityNote: string }>;
}) {
  const rounds = session.rounds;
  if (rounds.length === 0) {
    return {
      recapSummary: null,
      keyArguments: [],
      weaknesses: [],
      evidenceChain: [],
      personaDrift: [],
      factRisks: [],
      nextActions: [],
      exportAvailable: false,
    };
  }

  const latest = rounds.at(-1);
  const aAverage = averageFor(rounds, "A");
  const bAverage = averageFor(rounds, "B");
  const winner = winnerLabel(session.winner, aAverage, bAverage);
  const aScore = latest?.scores.find((score) => score.side === "A");
  const bScore = latest?.scores.find((score) => score.side === "B");
  const aStance = participant(session.participants, "A")?.stance ?? "甲方主张";
  const bStance = participant(session.participants, "B")?.stance ?? "乙方主张";
  const closed = session.status === "ended" || session.status === "stopped";

  return {
    recapSummary: `${closed ? "结案复盘" : "阶段复盘"}：${winner}。甲方均分 ${aAverage || "--"}，乙方均分 ${bAverage || "--"}；最新判词认为${latest?.judgeSummary ?? "双方仍需继续举证"}。`,
    keyArguments: [
      `甲方主线：${compact(aStance)}`,
      `乙方主线：${compact(bStance)}`,
      `最新攻防：${compact(latest?.judgeSummary ?? "等待裁判判词")}`,
    ],
    weaknesses: [
      `甲方需补强：${weakestDimension(aScore)}维度`,
      `乙方需补强：${weakestDimension(bScore)}维度`,
      "下一步：围绕裁判判词补证据、压缩概念边界，并直接回应对方最强论点。",
    ],
    evidenceChain:
      session.sourceCards && session.sourceCards.length > 0
        ? session.sourceCards.slice(0, 4).map((card) => `${card.sourceName}：${compact(card.title, 72)}`)
        : ["暂无外部来源卡；本场主要依赖双方论证自洽性。"],
    personaDrift:
      session.mode === "persona"
        ? [
            `甲方角色一致性：${aScore?.personaFidelity ?? "--"}/10`,
            `乙方角色一致性：${bScore?.personaFidelity ?? "--"}/10`,
            "若出现现代知识碾压、时代错位或口吻漂移，裁判应继续扣角色一致性。",
          ]
        : ["非人格模式：角色一致性按基础表达稳定度处理。"],
    factRisks:
      session.mode === "research"
        ? [
            `资料包来源数：${session.sourceCards?.length ?? 0}`,
            "未引用来源的具体新闻、数据、法律状态应被视为事实风险。",
          ]
        : ["非联网热点模式：事实风险未接入来源卡自动校验。"],
    nextActions: [
      "追问胜方最薄弱的证据链。",
      "要求败方重构最强反驳而不是重复立场。",
      "必要时降低最大回合或触发人工裁决，避免无效消耗。",
    ],
    exportAvailable: rounds.length > 0,
  };
}

export function exportSessionAsMarkdown(session: DebateSessionDTO) {
  const lines = [
    `# ${session.topic}`,
    "",
    `状态：${session.status}`,
    `裁决：${session.winner ?? "未判定"}`,
    `回合：${session.currentRound}/${session.maxRounds}`,
    "",
    "## 复盘摘要",
    session.recapSummary ?? "暂无复盘摘要。",
    "",
    "## 关键论点",
    ...session.keyArguments.map((item) => `- ${item}`),
    "",
    "## 薄弱环节",
    ...session.weaknesses.map((item) => `- ${item}`),
    "",
    "## 证据链",
    ...session.evidenceChain.map((item) => `- ${item}`),
    "",
    "## 角色一致性 / 事实风险",
    ...session.personaDrift.map((item) => `- ${item}`),
    ...session.factRisks.map((item) => `- ${item}`),
    "",
    "## 下一步建议",
    ...session.nextActions.map((item) => `- ${item}`),
    "",
    "## 来源卡",
    ...(session.sourceCards.length > 0
      ? session.sourceCards.map((card) => `- ${card.title} (${card.sourceName}) ${card.url}`)
      : ["- 暂无来源卡"]),
    "",
    "## 回合记录",
  ];

  for (const round of session.rounds) {
    lines.push(
      "",
      `### 第 ${round.roundNumber} 轮`,
      "",
      `甲方：${round.speakerAContent}`,
      "",
      `乙方：${round.speakerBContent}`,
      "",
      `裁判：${round.judgeSummary}`,
    );
  }

  return lines.join("\n");
}
