type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function normalizedHeaderValue(value: string | null) {
  const normalized = value?.trim();
  if (!normalized || normalized.toLowerCase() === "unknown") return null;
  return normalized;
}

function clientIp(request: Request) {
  const forwarded = normalizedHeaderValue(request.headers.get("x-forwarded-for")?.split(",")[0] ?? null);
  if (forwarded) return forwarded;

  return normalizedHeaderValue(request.headers.get("x-real-ip")) ?? "local";
}

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function consumeRateLimit(scope: string, request: Request, options: RateLimitOptions) {
  const now = Date.now();
  cleanup(now);

  const key = `${scope}:${clientIp(request)}`;
  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : {
          count: 0,
          resetAt: now + options.windowMs,
        };

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(options.limit - bucket.count, 0);
  return {
    allowed: bucket.count <= options.limit,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
  };
}

function rateLimitHeaders(result: ReturnType<typeof consumeRateLimit>) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function rateLimitResponse(result: ReturnType<typeof consumeRateLimit>) {
  return Response.json(
    { error: "请求过快，请稍后再试。" },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    },
  );
}
