import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { roadmapModules } from "@/lib/product/conversion";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const moduleIds = roadmapModules.map((module) => module.id) as [string, ...string[]];

const waitlistSchema = z.object({
  moduleId: z.enum(moduleIds),
  email: z.string().trim().email("请填写可联系邮箱").max(160),
  useCase: z.string().trim().min(4, "请写一句使用场景").max(600),
});

export async function POST(request: Request) {
  const limit = await consumeRateLimit("waitlist-create", request, {
    limit: 10,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const body = waitlistSchema.parse(await request.json());
    const lead = await prisma.waitlistLead.create({
      data: body,
    });

    return Response.json(
      {
        waitlist: {
          id: lead.id,
          moduleId: lead.moduleId,
          createdAt: lead.createdAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "加入等待名单失败。");
  }
}
