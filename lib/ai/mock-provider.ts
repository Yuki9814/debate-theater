import type { AIProvider, GenerateTextInput } from "./types.ts";
import type { JudgeResult, ScoreBreakdown } from "../debate/types.ts";
import { clamp } from "../utils.ts";

function textMeta(input: GenerateTextInput, key: string, fallback = "") {
  const value = input.metadata?.[key];
  return typeof value === "string" ? value : fallback;
}

function numberMeta(input: GenerateTextInput, key: string, fallback = 0) {
  const value = input.metadata?.[key];
  const numeric = typeof value === "number" ? value : Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 9973;
  }
  return hash;
}

function buildSpeech(input: GenerateTextInput) {
  const side = textMeta(input, "side", "A");
  const round = numberMeta(input, "round", 1);
  const topic = textMeta(input, "topic", "当前辩题");
  const stance = textMeta(input, "stance", side === "A" ? "甲方立场" : "乙方立场");
  const opponent = textMeta(input, "opponentStance", "对方立场");
  const personaName = textMeta(input, "personaName", "");
  const mode = textMeta(input, "mode", "free");
  const seed = hashText(`${topic}:${stance}:${round}:${side}`);
  const evidenceTone = seed % 2 === 0 ? "现实激励" : "二阶影响";
  const pressurePoint = seed % 3 === 0 ? "概念边界" : seed % 3 === 1 ? "代价权衡" : "举证责任";

  return [
    `${personaName ? `${personaName}会先说：` : ""}${stance}。第 ${round} 轮，本方把“${topic}”放在${pressurePoint}上审视，因为胜负取决于哪一种后果更应被优先看见。`,
    `核心论证是：${evidenceTone}会持续影响制度与普通决策者，判断标准不能停留在口号，而应落到可观察结果。`,
    `针对“${opponent}”，对方目前缺少因果优先级：提出了担忧，但尚未证明该担忧足以压倒本方主张。`,
    mode === "research" ? "本轮只把资料包能支撑的内容当成事实，其余判断明确作为推断处理。" : "",
    `下一轮请裁判重点比较机制完整度、证据质量，以及反驳是否真正击中对方最强论点。`,
  ].filter(Boolean).join(" ");
}

function scoreFromSeed(seed: number, bias: number): ScoreBreakdown {
  const logic = clamp(21 + ((seed + bias) % 10), 0, 30);
  const evidence = clamp(16 + ((seed + bias * 3) % 9), 0, 25);
  const rebuttal = clamp(12 + ((seed + bias * 5) % 8), 0, 20);
  const clarity = clamp(10 + ((seed + bias * 7) % 5), 0, 15);
  const personaFidelity = 8 + ((seed + bias * 11) % 3);
  const total = logic + evidence + rebuttal + clarity + personaFidelity;

  return {
    logic,
    evidence,
    rebuttal,
    clarity,
    persona_fidelity: personaFidelity,
    total,
  };
}

function buildJudge(input: GenerateTextInput): JudgeResult {
  const round = numberMeta(input, "round", 1);
  const topic = textMeta(input, "topic", "the topic");
  const seed = hashText(`${topic}:${round}`);
  const a = scoreFromSeed(seed, round + 3);
  const b = scoreFromSeed(seed + 17, round + 7);
  const leader = a.total === b.total ? null : a.total > b.total ? "A" : "B";
  const possibleLoser = leader === "A" && b.total < 55 ? "B" : leader === "B" && a.total < 55 ? "A" : null;
  const confidence = clamp(0.62 + ((seed + round) % 23) / 100, 0, 0.92);

  return {
    round,
    scores: { A: a, B: b },
    summary:
      leader === null
        ? "本轮接近均势：双方都有连贯主张，但证据颗粒度仍不足。"
        : `${leader === "A" ? "甲方" : "乙方"}凭借更清晰的因果结构与更准确的反驳目标占优。`,
    judge_comment:
      "下一轮应把证据讲得更具体，宏观判断需要配套机制说明。",
    possible_loser: possibleLoser,
    should_end: false,
    confidence,
  };
}

export class MockProvider implements AIProvider {
  id = "mock";
  name = "本地模拟剧场";

  async generateText(input: GenerateTextInput) {
    return buildSpeech(input);
  }

  async generateJSON<T>(input: GenerateTextInput) {
    return buildJudge(input) as T;
  }
}
