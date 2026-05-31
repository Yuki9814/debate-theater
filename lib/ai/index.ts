import { MockProvider } from "./mock-provider.ts";
import { CustomOpenAICompatibleProvider, OpenAIProvider } from "./openai-provider.ts";
import type { AIProvider } from "./types.ts";
import { type ProviderId, providerIds } from "../debate/types.ts";
import { decryptSecret, encryptSecret, maskSecret } from "../security/secrets.ts";

function isProviderId(value: string): value is ProviderId {
  return (providerIds as readonly string[]).includes(value);
}

export function encryptApiKey(apiKey: string) {
  return encryptSecret(apiKey);
}

export function decryptApiKey(encryptedApiKey?: string | null) {
  return decryptSecret(encryptedApiKey);
}

export function maskApiKey(encryptedApiKey?: string | null) {
  return maskSecret(encryptedApiKey);
}

export function createProvider(params: {
  providerId?: string | null;
  apiKey?: string | null;
  baseUrl?: string | null;
  defaultModel?: string | null;
}): AIProvider {
  const id = params.providerId ?? "mock";
  const providerId = isProviderId(id) ? id : "mock";

  if (providerId === "openai") {
    return new OpenAIProvider({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      defaultModel: params.defaultModel,
    });
  }

  if (providerId === "custom-openai") {
    return new CustomOpenAICompatibleProvider({
      apiKey: params.apiKey,
      baseUrl: params.baseUrl,
      defaultModel: params.defaultModel,
    });
  }

  return new MockProvider();
}
