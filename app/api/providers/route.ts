import { encryptApiKey } from "@/lib/ai";
import { providerBaseUrlSchema } from "@/lib/ai/provider-url";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { providerView } from "@/lib/providers/view";
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

export async function GET(request: Request) {
  const limit = consumeRateLimit("providers-list", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await getCurrentUser();
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
    const user = await getCurrentUser();
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
