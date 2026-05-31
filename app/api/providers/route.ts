import { encryptApiKey, maskApiKey } from "@/lib/ai";
import { providerBaseUrlSchema } from "@/lib/ai/provider-url";
import { ensureDemoUser } from "@/lib/debate/engine";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { canEncryptSecrets } from "@/lib/security/secrets";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { z } from "zod";

const providerCreateSchema = z.object({
  providerName: z.enum(["mock", "openai", "custom-openai"]),
  baseUrl: providerBaseUrlSchema,
  apiKey: z.string().trim().max(500).optional().or(z.literal("")),
  defaultModel: z.string().trim().max(100).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
});

function providerView(provider: {
  id: string;
  providerName: string;
  baseUrl: string | null;
  encryptedApiKey: string | null;
  defaultModel: string | null;
  enabled: boolean;
}) {
  return {
    id: provider.id,
    providerName: provider.providerName,
    baseUrl: provider.baseUrl,
    keyPreview: maskApiKey(provider.encryptedApiKey),
    hasApiKey: Boolean(provider.encryptedApiKey),
    defaultModel: provider.defaultModel,
    enabled: provider.enabled,
  };
}

export async function GET(request: Request) {
  const limit = consumeRateLimit("providers-list", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await ensureDemoUser();
    const providers = await prisma.apiProvider.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });

    return Response.json({
      providers: providers.map(providerView),
      secretEncryptionConfigured: canEncryptSecrets(),
    });
  } catch (error) {
    return errorResponse(error, "读取供应商失败。", 500);
  }
}

export async function POST(request: Request) {
  const limit = consumeRateLimit("providers-create", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await ensureDemoUser();
    const body = providerCreateSchema.parse(await request.json());

    const provider = await prisma.apiProvider.create({
      data: {
        userId: user.id,
        providerName: body.providerName,
        baseUrl: body.baseUrl || null,
        encryptedApiKey: body.apiKey ? encryptApiKey(body.apiKey) : null,
        defaultModel: body.defaultModel || null,
        enabled: body.enabled ?? true,
      },
    });

    return Response.json({ provider: providerView(provider) }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "保存供应商失败。");
  }
}
