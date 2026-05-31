import { z } from "zod";
import { recommendPersonaTopics } from "@/lib/persona/presets";
import { errorResponse } from "@/lib/errors";
import { consumeRateLimit, rateLimitResponse } from "@/lib/security/rate-limit";

const recommendSchema = z.object({
  left: z.string().trim().min(1).max(80),
  right: z.string().trim().min(1).max(80),
});

export async function POST(request: Request) {
  const limit = consumeRateLimit("personas-recommend-topics", request, {
    limit: 40,
    windowMs: 60_000,
  });
  if (!limit.allowed) return rateLimitResponse(limit);

  try {
    const body = recommendSchema.parse(await request.json());
    return Response.json({ topics: recommendPersonaTopics(body.left, body.right) });
  } catch (error) {
    return errorResponse(error, "推荐辩题失败。");
  }
}
