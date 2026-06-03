import { createHash } from "node:crypto";
import { authCookieName } from "../auth/constants.ts";

type RateLimitOptions = {
  limit: number;
  windowMs: number;
  identity?: string | null;
};

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
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

function trustProxyHeaders() {
  return process.env.TRUST_PROXY_HEADERS === "true";
}

function clientIp(request: Request) {
  if (!trustProxyHeaders()) return "direct";

  const forwarded = normalizedHeaderValue(request.headers.get("x-forwarded-for")?.split(",")[0] ?? null);
  if (forwarded) return forwarded;

  return normalizedHeaderValue(request.headers.get("x-real-ip")) ?? "direct";
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return null;
}

function requestIdentity(request: Request, explicitIdentity?: string | null) {
  const normalized = normalizedHeaderValue(explicitIdentity ?? null);
  if (normalized) return `identity:${normalized}`;

  const sessionToken = cookieValue(request, authCookieName);
  if (!sessionToken) return "anonymous";
  return `session:${createHash("sha256").update(sessionToken).digest("hex")}`;
}

function cleanup(now: number) {
  if (buckets.size < 1000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

function consumeMemoryRateLimit(key: string, options: RateLimitOptions, now: number): RateLimitResult {
  cleanup(now);

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

async function consumeDistributedRateLimit(key: string, options: RateLimitOptions, now: number): Promise<RateLimitResult | null> {
  if (process.env.RATE_LIMIT_BACKEND !== "upstash") return null;

  const restUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, "");
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!restUrl || !restToken) return null;

  const redisKey = `lunheng:rate:${createHash("sha256").update(key).digest("hex")}`;
  return fetch(`${restUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${restToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", redisKey, "0", "PX", String(options.windowMs), "NX"],
      ["INCR", redisKey],
      ["PTTL", redisKey],
    ]),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`Upstash rate limit failed with ${response.status}`);
      const results = (await response.json()) as Array<{ result?: unknown }>;
      const count = Number(results[1]?.result ?? 0);
      const ttl = Number(results[2]?.result ?? options.windowMs);
      const resetAt = now + Math.max(Number.isFinite(ttl) && ttl > 0 ? ttl : options.windowMs, 0);
      return {
        allowed: count <= options.limit,
        limit: options.limit,
        remaining: Math.max(options.limit - count, 0),
        resetAt,
      };
    })
    .catch(() => {
      if (process.env.NODE_ENV === "production") {
        return {
          allowed: false,
          limit: options.limit,
          remaining: 0,
          resetAt: now + options.windowMs,
        };
      }
      return consumeMemoryRateLimit(key, options, now);
    });
}

export async function consumeRateLimit(scope: string, request: Request, options: RateLimitOptions) {
  const now = Date.now();
  const key = `${scope}:${requestIdentity(request, options.identity)}:${clientIp(request)}`;
  const distributed = await consumeDistributedRateLimit(key, options, now);
  return distributed ?? consumeMemoryRateLimit(key, options, now);
}

function rateLimitHeaders(result: RateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "请求过快，请稍后再试。" },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    },
  );
}
