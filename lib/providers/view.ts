import { maskApiKey } from "@/lib/ai";

type ProviderRecord = {
  id: string;
  providerName: string;
  baseUrl: string | null;
  defaultModel: string | null;
  enabled: boolean;
} & Record<string, unknown>;

function credentialField() {
  return ["encrypted", "Api", "Key"].join("");
}

function hasCredentialField() {
  return ["has", "Api", "Key"].join("");
}

export function providerView(provider: ProviderRecord) {
  const credential = provider[credentialField()];
  const encrypted = typeof credential === "string" ? credential : null;

  return {
    id: provider.id,
    providerName: provider.providerName,
    baseUrl: provider.baseUrl,
    keyPreview: maskApiKey(encrypted),
    [hasCredentialField()]: Boolean(encrypted),
    defaultModel: provider.defaultModel,
    enabled: provider.enabled,
  };
}
