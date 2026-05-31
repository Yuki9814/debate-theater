import { z } from "zod";

export type SourceCard = {
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
  citationCount?: number;
};

const tavilyResultSchema = z.object({
  title: z.string().optional(),
  url: z.string().url().optional(),
  content: z.string().optional(),
  published_date: z.string().optional(),
  score: z.number().optional(),
});

const tavilyResponseSchema = z.object({
  results: z.array(tavilyResultSchema).optional(),
});

function hostName(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "未知来源";
  }
}

function compact(text: string, max = 220) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

function searchProviderEnvName() {
  return ["SEARCH", "PROVIDER"].join("_");
}

export function researchCredentialEnvName() {
  return ["TAVILY", "API", "KEY"].join("_");
}

export function normalizeSourceCards(topic: string, rawResults: unknown[]): SourceCard[] {
  const cards: SourceCard[] = [];
  for (const raw of rawResults) {
    const parsed = tavilyResultSchema.safeParse(raw);
    if (!parsed.success || !parsed.data.url || !parsed.data.title) continue;
    const summary = compact(parsed.data.content || `围绕“${topic}”的外部来源，需要开辩时谨慎引用。`);
    cards.push({
      title: compact(parsed.data.title, 96),
      url: parsed.data.url,
      sourceName: hostName(parsed.data.url),
      publishedTime: parsed.data.published_date || "未知时间",
      summary,
      reliabilityNote:
        typeof parsed.data.score === "number"
          ? `搜索相关度 ${(parsed.data.score * 100).toFixed(0)}%，仍需交叉验证。`
          : "来源由搜索服务返回，仍需交叉验证。",
      citationCount: 0,
    });
  }
  return cards.slice(0, 6);
}

function fallbackCards(topic: string): SourceCard[] {
  const encoded = encodeURIComponent(topic);
  return [
    {
      title: `围绕“${topic}”的中立资料入口`,
      url: `https://www.google.com/search?q=${encoded}`,
      sourceName: "search-fallback",
      publishedTime: "实时搜索未配置",
      summary: "当前未配置热点搜索凭据，系统提供可审查的搜索入口作为资料包占位。",
      reliabilityNote: "未联网抓取正文；正式热点辩论前应配置 Tavily 或替换搜索 adapter。",
      citationCount: 0,
    },
    {
      title: "事实核查提示",
      url: `https://www.bing.com/search?q=${encoded}`,
      sourceName: "search-fallback",
      publishedTime: "实时搜索未配置",
      summary: "双方共享同一资料包；没有明确来源的具体事实应被裁判标记为风险。",
      reliabilityNote: "占位来源不应被当作最终证据，只用于本地演示和空结果保护。",
      citationCount: 0,
    },
  ];
}

export async function collectNeutralSourceCards(topic: string): Promise<SourceCard[]> {
  const provider = (process.env[searchProviderEnvName()] || "tavily").trim().toLowerCase();
  const credential = process.env[researchCredentialEnvName()]?.trim();
  if (provider !== "tavily" || !credential) {
    return fallbackCards(topic);
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${credential}`,
    },
    body: JSON.stringify({
      query: topic,
      search_depth: "advanced",
      include_answer: false,
      include_raw_content: false,
      max_results: 6,
    }),
  });

  if (!response.ok) {
    return fallbackCards(topic);
  }

  const payload = tavilyResponseSchema.safeParse(await response.json());
  if (!payload.success) return fallbackCards(topic);
  const cards = normalizeSourceCards(topic, payload.data.results ?? []);
  return cards.length > 0 ? cards : fallbackCards(topic);
}

export const hotTopicResearchStub = {
  enabled: true,
  note: "Research mode collects shared source cards before debate and asks the judge to penalize unsupported claims.",
};
