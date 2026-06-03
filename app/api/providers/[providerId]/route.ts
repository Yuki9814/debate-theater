import { z } from "zod";
import { providerBaseUrlSchema } from "@/lib/ai/provider-url";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { providerView } from "@/lib/providers/view";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

type RouteContext = {
  params: Promise<{ providerId: string }>;
};

const providerUpdateSchema = z.object({
  providerName: z.enum(["mock", "openai", "custom-openai"]).optional(),
  baseUrl: providerBaseUrlSchema.optional(),
  defaultModel: z.string().trim().max(100).optional().or(z.literal("")),
  enabled: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const limit = await consumeRateLimit("providers-update", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const { providerId } = await context.params;
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const body = providerUpdateSchema.parse(await request.json());
    const update: Parameters<typeof prisma.apiProvider.update>[0]["data"] = {};
    if (typeof body.providerName !== "undefined") update.providerName = body.providerName;
    if (typeof body.baseUrl !== "undefined") update.baseUrl = body.baseUrl || null;
    if (typeof body.defaultModel !== "undefined") update.defaultModel = body.defaultModel || null;
    if (typeof body.enabled !== "undefined") update.enabled = body.enabled;

    const provider = await prisma.apiProvider.update({
      where: { id: providerId, userId: user.id },
      data: update,
    });
    return Response.json({ provider: providerView(provider) });
  } catch (error) {
    return errorResponse(error, "更新供应商失败。");
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const limit = await consumeRateLimit("providers-delete", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const { providerId } = await context.params;
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    await prisma.apiProvider.delete({ where: { id: providerId, userId: user.id } });
    return Response.json({ ok: true });
  } catch (error) {
    return errorResponse(error, "删除供应商失败。");
  }
}
