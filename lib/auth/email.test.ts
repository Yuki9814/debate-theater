import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { canExposeLoginUrl, getEmailReadiness, sendLoginLinkEmail } from "./email.ts";
import { AppError } from "../errors.ts";

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

describe("login link email delivery", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("does not expose login URLs in production", () => {
    setEnv("NODE_ENV", "production");
    assert.equal(canExposeLoginUrl(), false);
  });

  it("exposes login URLs in local development", () => {
    setEnv("NODE_ENV", "development");
    assert.equal(canExposeLoginUrl(), true);
  });

  it("requires configured email delivery in production", async () => {
    setEnv("NODE_ENV", "production");
    setEnv(emailProviderEnvName, undefined);

    await assert.rejects(
      () =>
        sendLoginLinkEmail({
          to: "reader@example.com",
          verificationUrl: "https://app.example.com/login?token=secret",
          expiresAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      (error) => error instanceof AppError && error.code === "EMAIL_NOT_CONFIGURED",
    );
  });

  it("detects Resend delivery configuration", () => {
    setEnv(emailProviderEnvName, "resend");
    setEnv(emailServiceCredentialEnvName, "re_test");
    setEnv(emailFromEnvName, "no-reply@example.com");

    assert.deepEqual(getEmailReadiness(), {
      provider: "resend",
      configured: true,
      deliveryEnabled: true,
    });
  });
});
