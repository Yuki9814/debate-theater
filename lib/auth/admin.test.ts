import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isAdminEmail, requireAdminEmail } from "./admin.ts";
import { AppError } from "../errors.ts";

describe("admin email checks", () => {
  it("matches configured admin emails case-insensitively", () => {
    assert.equal(isAdminEmail("Owner@Example.com", "owner@example.com,ops@example.com"), true);
    assert.equal(isAdminEmail("guest@example.com", "owner@example.com"), false);
  });

  it("throws explicit auth and admin errors", () => {
    assert.throws(() => requireAdminEmail(null, "owner@example.com"), (error) => error instanceof AppError && error.code === "AUTH_REQUIRED");
    assert.throws(
      () => requireAdminEmail("guest@example.com", "owner@example.com"),
      (error) => error instanceof AppError && error.code === "ADMIN_REQUIRED",
    );
  });
});
