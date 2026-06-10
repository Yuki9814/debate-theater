import { z } from "zod";
import { requireAdminEmail } from "@/lib/auth/admin";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { roadmapModules } from "@/lib/product/conversion";
import { summarizeWaitlistLeads, waitlistLeadsToCsv } from "@/lib/product/waitlist";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const moduleIds = roadmapModules.map((module) => module.id) as [string, ...string[]];

const waitlistSchema = z.object({
  moduleId: z.enum(moduleIds),
  email: z.string().trim().email("请填写可联系邮箱").max(160),
  useCase: z.string().trim().min(4, "请写一句使用场景").max(600),
});

export async function GET(request: Request) {
  const limit = await consumeRateLimit("waitlist-admin-read", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const authenticated = await getAuthenticatedUser();
    requireAdminEmail(authenticated?.email);
    const leads = await prisma.waitlistLead.findMany({
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
    const url = new URL(request.url);
    if (url.searchParams.get("format") === "csv") {
      return new Response(waitlistLeadsToCsv(leads), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="lunheng-waitlist.csv"',
        },
      });
    }

    return Response.json({
      total: leads.length,
      modules: summarizeWaitlistLeads(leads),
      leads: leads.map((lead) => ({
        ...lead,
        createdAt: lead.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return errorResponse(error, "读取等待名单失败。", 500);
  }
}

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
