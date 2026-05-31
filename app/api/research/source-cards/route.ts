import { z } from "zod";
import { collectNeutralSourceCards } from "@/lib/research/source-cards";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const sourceCardSchema = z.object({
  topic: z.string().trim().min(4).max(500),
});

export async function POST(request: Request) {
  const limit = consumeRateLimit("research-source-cards", request, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const body = sourceCardSchema.parse(await request.json());
    const sourceCards = await collectNeutralSourceCards(body.topic);
    return Response.json({ sourceCards });
  } catch (error) {
    return errorResponse(error, "生成资料包失败。");
  }
}
