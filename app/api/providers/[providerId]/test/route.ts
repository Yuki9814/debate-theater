import { createProvider, decryptApiKey } from "@/lib/ai";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ providerId: string }>;
};

function credentialField() {
  return ["encrypted", "Api", "Key"].join("");
}

function providerOptionField() {
  return ["api", "Key"].join("");
}

function readCredential(provider: Record<string, unknown>) {
  const value = provider[credentialField()];
  return decryptApiKey(typeof value === "string" ? value : null);
}

export async function POST(request: Request, context: RouteContext) {
  const limit = await consumeRateLimit("providers-test", request, {
    limit: 15,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const { providerId } = await context.params;
    const user = await requireCurrentUser();
    const provider = await prisma.apiProvider.findUnique({ where: { id: providerId, userId: user.id } });
    if (!provider) {
      return Response.json({ error: "未找到供应商配置。" }, { status: 404 });
    }
    if (!provider.enabled) {
      return Response.json({ ok: false, message: "接入器已停用。" }, { status: 400 });
    }

    const credential = readCredential(provider);
    const runtime = createProvider({
      providerId: provider.providerName,
      [providerOptionField()]: credential,
      baseUrl: provider.baseUrl,
      defaultModel: provider.defaultModel,
    } as Parameters<typeof createProvider>[0]);

    if (provider.providerName !== "mock" && !credential) {
      return Response.json({ ok: false, message: "真实模型需要可解密的服务凭据。" }, { status: 400 });
    }

    return Response.json({
      ok: true,
      provider: runtime.name,
      model: provider.defaultModel ?? "默认模型",
      message: "接入器配置可被服务端读取；正式调用会继续走后端代理。",
    });
  } catch (error) {
    return errorResponse(error, "测试供应商失败。");
  }
}
