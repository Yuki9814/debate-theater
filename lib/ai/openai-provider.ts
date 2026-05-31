import {
  AIAuthenticationError,
  AIProviderError,
  AIRateLimitError,
  AITimeoutError,
} from "../errors.ts";
import { normalizeProviderBaseUrl } from "./provider-url.ts";
import type { AIProvider, GenerateTextInput } from "./types.ts";

type OpenAIProviderOptions = {
  id?: string;
  name?: string;
  apiKey?: string | null;
  baseUrl?: string | null;
  defaultModel?: string | null;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";

function parseJSONContent(content: string) {
  const trimmed = content.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  return JSON.parse(unfenced);
}

function normalizeModel(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeApiKey(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeTemperature(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0.7;
  }
  return value;
}

function parseAiProviderNumericEnv(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveAiProviderTimeoutMs(value: string | null | undefined = process.env.AI_PROVIDER_TIMEOUT_MS) {
  const parsed = parseAiProviderNumericEnv(value);
  return parsed !== null && parsed > 0 ? parsed : 60_000;
}

export function resolveAiProviderMaxRetries(value: string | null | undefined = process.env.AI_PROVIDER_MAX_RETRIES) {
  const parsed = parseAiProviderNumericEnv(value);
  if (parsed === null || parsed < 0) return 0;
  return Math.min(Math.floor(parsed), 5);
}

export function resolveAiProviderRetryBaseDelayMs(value: string | null | undefined = process.env.AI_PROVIDER_RETRY_BASE_DELAY_MS) {
  const parsed = parseAiProviderNumericEnv(value);
  return parsed !== null && parsed >= 0 ? parsed : 250;
}

function isRetryableStatus(status: number) {
  return status === 429 || (status >= 500 && status <= 504);
}

export class OpenAIProvider implements AIProvider {
  id: string;
  name: string;
  private apiKey: string | null;
  private baseUrl: string;
  private defaultModel: string;

  constructor(options: OpenAIProviderOptions = {}) {
    this.id = options.id ?? "openai";
    this.name = options.name ?? "OpenAI";
    this.apiKey = normalizeApiKey(options.apiKey ?? process.env.OPENAI_API_KEY);
    this.baseUrl = normalizeProviderBaseUrl(options.baseUrl ?? process.env.OPENAI_BASE_URL) ?? "https://api.openai.com/v1";
    this.defaultModel = normalizeModel(options.defaultModel) ?? normalizeModel(process.env.OPENAI_DEFAULT_MODEL) ?? DEFAULT_OPENAI_MODEL;
  }

  async generateText(input: GenerateTextInput) {
    return this.request(input, false);
  }

  async generateJSON<T>(input: GenerateTextInput) {
    const content = await this.request(input, true);
    try {
      return parseJSONContent(content) as T;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new AIProviderError("Provider returned malformed JSON content.");
      }
      throw err;
    }
  }

  private async request(input: GenerateTextInput, jsonMode: boolean) {
    if (!this.apiKey) {
      throw new AIAuthenticationError("OpenAI API key is not configured on the server.");
    }

    const maxRetries = resolveAiProviderMaxRetries();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        const delay = Math.min(resolveAiProviderRetryBaseDelayMs() * 2 ** (attempt - 1), 5000);
        if (delay > 0) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), resolveAiProviderTimeoutMs());

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: normalizeModel(input.model) ?? this.defaultModel,
            messages: input.messages,
            temperature: normalizeTemperature(input.temperature),
            response_format: jsonMode ? { type: "json_object" } : undefined,
          }),
        });

        if (!response.ok) {
          const detail = await response.text();
          console.error(`Provider request failed (attempt ${attempt + 1}/${maxRetries + 1})`, {
            provider: this.id,
            status: response.status,
            detail: detail.slice(0, 500),
          });

          if (response.status === 401 || response.status === 403) {
            throw new AIAuthenticationError();
          }

          if (isRetryableStatus(response.status)) {
            lastError = response.status === 429 ? new AIRateLimitError() : new AIProviderError(`Provider request failed with status ${response.status}.`);
            if (attempt < maxRetries) continue;
            throw lastError;
          }

          throw new AIProviderError(`Provider request failed with status ${response.status}.`);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;

        if (typeof content !== "string" || content.trim() === "") {
          throw new AIProviderError("Provider returned an empty response.");
        }

        return content;
      } catch (err: unknown) {
        if (err instanceof AIAuthenticationError) throw err;

        if (err instanceof AIProviderError || err instanceof AIRateLimitError || err instanceof AITimeoutError) {
          throw err;
        }

        lastError = err instanceof Error ? err : new Error(String(err));
        if (err instanceof Error && err.name === "AbortError") {
          throw new AITimeoutError();
        }

        if (attempt < maxRetries) {
          console.warn(`Retryable error in ${this.id} (attempt ${attempt + 1}): ${lastError.message}`);
          continue;
        }

        throw new AIProviderError(`Network error while calling provider: ${lastError.message}`);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw lastError || new AIProviderError("Unknown provider error after retries.");
  }
}

export class CustomOpenAICompatibleProvider extends OpenAIProvider {
  constructor(options: OpenAIProviderOptions = {}) {
    const defaultModel = normalizeModel(options.defaultModel) ?? normalizeModel(process.env.CUSTOM_OPENAI_DEFAULT_MODEL);

    super({
      id: "custom-openai",
      name: "OpenAI Compatible",
      baseUrl: options.baseUrl ?? process.env.CUSTOM_OPENAI_BASE_URL,
      apiKey: options.apiKey ?? process.env.CUSTOM_OPENAI_API_KEY,
      defaultModel,
    });
  }
}
