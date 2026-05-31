import { estimateTokens } from "../utils.ts";

type CostInput = {
  providerId?: string | null;
  inputTokens: number;
  outputTokens: number;
};

function numberEnv(name: string, fallback = 0) {
  const value = Number(process.env[name] ?? fallback);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function pricingFor(providerId?: string | null) {
  if (providerId === "mock") {
    return { inputPer1k: 0, outputPer1k: 0 };
  }

  if (providerId === "custom-openai") {
    return {
      inputPer1k: numberEnv("CUSTOM_OPENAI_INPUT_COST_PER_1K_USD"),
      outputPer1k: numberEnv("CUSTOM_OPENAI_OUTPUT_COST_PER_1K_USD"),
    };
  }

  return {
    inputPer1k: numberEnv("OPENAI_INPUT_COST_PER_1K_USD"),
    outputPer1k: numberEnv("OPENAI_OUTPUT_COST_PER_1K_USD"),
  };
}

export function estimateTextTokenCount(text: string) {
  return estimateTokens(text);
}

function normalizeTokenCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function estimateProviderCostUsd(input: CostInput) {
  const pricing = pricingFor(input.providerId);
  const inputTokens = normalizeTokenCount(input.inputTokens);
  const outputTokens = normalizeTokenCount(input.outputTokens);
  const cost =
    (inputTokens / 1000) * pricing.inputPer1k +
    (outputTokens / 1000) * pricing.outputPer1k;
  return Number(cost.toFixed(6));
}
