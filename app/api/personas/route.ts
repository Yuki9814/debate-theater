import { z } from "zod";
import { requireCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/errors";
import { personaPresets } from "@/lib/persona/presets";
import { requireMutationSecurity } from "@/lib/security/mutation";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const personaCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  category: z.string().trim().min(1).max(40),
  era: z.string().trim().max(80).optional().or(z.literal("")),
  description: z.string().trim().min(1).max(500),
  coreBeliefs: z.string().trim().min(1).max(500),
  speakingStyle: z.string().trim().min(1).max(300),
  experiences: z.string().trim().min(1).max(500),
  debateStrengths: z.string().trim().min(1).max(300),
  blindSpots: z.string().trim().min(1).max(300),
});

export async function GET(request: Request) {
  const limit = await consumeRateLimit("personas-list", request, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const user = await requireCurrentUser();
    const custom = await prisma.persona.findMany({
      where: { createdByUserId: user.id },
      orderBy: { name: "asc" },
    });
    return Response.json({
      personas: [
        ...personaPresets.map((persona) => ({ ...persona, isSystemPreset: true })),
        ...custom.map((persona) => ({ ...persona, isSystemPreset: false })),
      ],
    });
  } catch (error) {
    return errorResponse(error, "读取人格失败。", 500);
  }
}

export async function POST(request: Request) {
  const limit = await consumeRateLimit("personas-create", request, {
    limit: 20,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    requireMutationSecurity(request);
    const user = await requireCurrentUser();
    const body = personaCreateSchema.parse(await request.json());
    const persona = await prisma.persona.create({
      data: {
        ...body,
        era: body.era || null,
        createdByUserId: user.id,
      },
    });
    return Response.json({ persona }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "创建人格失败。");
  }
}
