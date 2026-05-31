import { ProviderSettings } from "@/components/debate/provider-settings";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { maskApiKey } from "@/lib/ai";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const providers = await prisma.apiProvider.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell>
      <ProviderSettings
        initialProviders={providers.map((provider) => ({
          id: provider.id,
          providerName: provider.providerName,
          baseUrl: provider.baseUrl,
          keyPreview: maskApiKey(provider.encryptedApiKey),
          hasApiKey: Boolean(provider.encryptedApiKey),
          defaultModel: provider.defaultModel,
          enabled: provider.enabled,
        }))}
      />
    </AppShell>
  );
}
