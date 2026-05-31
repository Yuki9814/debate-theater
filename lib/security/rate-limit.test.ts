import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { consumeRateLimit, rateLimitResponse } from "./rate-limit.ts";

describe("rate limiting", () => {
  it("allows requests within the limit", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "127.0.0.1" },
    });

    const result = consumeRateLimit("test-scope", request, {
      limit: 2,
      windowMs: 1000,
    });

    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 1);
    assert.equal(result.limit, 2);
  });

  it("blocks requests exceeding the limit", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "1.2.3.4" },
    });

    // First request
    consumeRateLimit("blocked-scope", request, { limit: 1, windowMs: 1000 });

    // Second request
    const result = consumeRateLimit("blocked-scope", request, { limit: 1, windowMs: 1000 });

    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
  });

  it("resets after the window expires", async () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "5.6.7.8" },
    });

    const options = { limit: 1, windowMs: 10 }; // Very short window

    consumeRateLimit("reset-scope", request, options);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 20));

    const result = consumeRateLimit("reset-scope", request, options);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
  });

  it("uses x-forwarded-for for client IP if available", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "10.0.0.1, 192.168.0.1" },
    });

    const result = consumeRateLimit("ip-scope", request, { limit: 1, windowMs: 1000 });
    assert.equal(result.allowed, true);
  });

  it("differentiates between scopes", () => {
    const request = new Request("http://localhost/api", {
      headers: { "x-real-ip": "9.9.9.9" },
    });

    consumeRateLimit("scope-a", request, { limit: 1, windowMs: 1000 });
    const result = consumeRateLimit("scope-b", request, { limit: 1, windowMs: 1000 });

    assert.equal(result.allowed, true);
  });

  it("normalizes blank, whitespace, and unknown client IP headers", () => {
    const options = { limit: 1, windowMs: 1000 };

    const spacedRealIp = new Request("http://localhost/api", {
      headers: { "x-real-ip": " 1.1.1.1 " },
    });
    const trimmedRealIp = new Request("http://localhost/api", {
      headers: { "x-real-ip": "1.1.1.1" },
    });
    consumeRateLimit("normalize-trim", spacedRealIp, options);
    assert.equal(consumeRateLimit("normalize-trim", trimmedRealIp, options).allowed, false);

    const unknownForwarded = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": "unknown", "x-real-ip": "2.2.2.2" },
    });
    const realIpOnly = new Request("http://localhost/api", {
      headers: { "x-real-ip": "2.2.2.2" },
    });
    consumeRateLimit("normalize-unknown", unknownForwarded, options);
    assert.equal(consumeRateLimit("normalize-unknown", realIpOnly, options).allowed, false);

    const blankHeaders = new Request("http://localhost/api", {
      headers: { "x-forwarded-for": " ", "x-real-ip": " UNKNOWN " },
    });
    const noHeaders = new Request("http://localhost/api");
    consumeRateLimit("normalize-local", blankHeaders, options);
    assert.equal(consumeRateLimit("normalize-local", noHeaders, options).allowed, false);
  });

  it("returns a 429 response with correct headers and body", async () => {
    const result = {
      allowed: false,
      limit: 5,
      remaining: 0,
      resetAt: 1700000000000,
    };

    const response = rateLimitResponse(result);

    assert.equal(response.status, 429);

    const body = await response.json();
    assert.deepEqual(body, { error: "请求过快，请稍后再试。" });

    assert.equal(response.headers.get("RateLimit-Limit"), "5");
    assert.equal(response.headers.get("RateLimit-Remaining"), "0");
    assert.equal(response.headers.get("RateLimit-Reset"), "1700000000");
  });
});
