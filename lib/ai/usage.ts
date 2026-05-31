import { estimateProviderCostUsd, estimateTextTokenCount } from "./cost.ts";

export type UsageResult = {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

export type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function calculateUsage(params: {
  providerId: string | null;
  messages: Message[];
  outputContent: string;
}): UsageResult {
  const inputTokens = estimateTextTokenCount(
    params.messages.map((m) => m.content).join("\n")
  );
  const outputTokens = estimateTextTokenCount(params.outputContent);
  const estimatedCostUsd = estimateProviderCostUsd({
    providerId: params.providerId,
    inputTokens,
    outputTokens,
  });

  return {
    inputTokens,
    outputTokens,
    estimatedCostUsd,
  };
}

export function aggregateUsage(results: UsageResult[]): UsageResult {
  return results.reduce(
    (acc, curr) => ({
      inputTokens: acc.inputTokens + (Number.isFinite(curr.inputTokens) ? Math.max(0, Math.floor(curr.inputTokens)) : 0),
      outputTokens: acc.outputTokens + (Number.isFinite(curr.outputTokens) ? Math.max(0, Math.floor(curr.outputTokens)) : 0),
      estimatedCostUsd: Number((acc.estimatedCostUsd + (Number.isFinite(curr.estimatedCostUsd) ? Math.max(0, curr.estimatedCostUsd) : 0)).toFixed(6)),
    }),
    { inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 }
  );
}
