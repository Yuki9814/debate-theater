import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildReadinessStatus } from "./readiness.ts";
import { researchCredentialEnvName } from "../research/source-cards.ts";

const savedEnv = { ...process.env };

function restoreEnv() {
  process.env = { ...savedEnv };
}

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

const emailProviderEnvName = ["EMAIL", "PROVIDER"].join("_");
const emailFromEnvName = ["EMAIL", "FROM"].join("_");
const emailServiceCredentialEnvName = ["RESEND", "API", "KEY"].join("_");

describe("production readiness status", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("reports blockers when production services are missing", () => {
    setEnv("NODE_ENV", "production");
    delete process.env.APP_ORIGIN;
    setEnv(emailProviderEnvName, undefined);
    delete process.env.API_KEY_ENCRYPTION_SECRET;
    delete process.env.STRIPE_SECRET_KEY;
    setEnv(researchCredentialEnvName(), undefined);
    delete process.env.RATE_LIMIT_BACKEND;
    delete process.env.SENTRY_DSN;
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

    const status = buildReadinessStatus();

    assert.equal(status.productionReady, false);
    assert.equal(status.emailConfigured, false);
    assert.equal(status.rateLimitConfigured, false);
    assert.ok(status.blockers.some((blocker) => blocker.includes("APP_ORIGIN")));
  });

  it("passes when all public beta services are configured", () => {
    setEnv("NODE_ENV", "production");
    process.env.APP_ORIGIN = "https://app.example.com";
    setEnv(emailProviderEnvName, "resend");
    setEnv(emailServiceCredentialEnvName, "re_test");
    setEnv(emailFromEnvName, "no-reply@example.com");
    process.env.API_KEY_ENCRYPTION_SECRET = "abcdefghijklmnopqrstuvwxyz123456";
    process.env.STRIPE_SECRET_KEY = "sk_test";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro";
    process.env.STRIPE_PRICE_STUDIO_MONTHLY = "price_studio";
    setEnv(researchCredentialEnvName(), "tvly-test");
    process.env.RATE_LIMIT_BACKEND = "upstash";
    process.env.UPSTASH_REDIS_REST_URL = "https://redis.example.com";
    process.env.UPSTASH_REDIS_REST_TOKEN = "token";
    process.env.SENTRY_DSN = "https://sentry.example.com/1";
    process.env.DEMO_MODE = "false";

    const status = buildReadinessStatus();

    assert.equal(status.productionReady, true);
    assert.equal(status.blockers.length, 0);
  });
});
