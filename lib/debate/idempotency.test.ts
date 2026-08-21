import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import { resolveRoundRequestId } from "./idempotency.ts";

describe("round request idempotency keys", () => {
  it("preserves a valid caller key", () => {
    const request = new Request("https://app.example/api/round", {
      headers: { "Idempotency-Key": "round:session-1:2:request-123" },
    });

    assert.equal(resolveRoundRequestId(request), "round:session-1:2:request-123");
  });

  it("creates a stable-format key when the caller omitted one", () => {
    const value = resolveRoundRequestId(new Request("https://app.example/api/round"));

    assert.match(value, /^[0-9a-f-]{36}$/);
  });

  it("rejects short, oversized, whitespace, and header-injection values", () => {
    for (const value of ["short", "has spaces 123", `a${"b".repeat(128)}`, "line\nbreak-value"]) {
      const headers = new Headers();
      try {
        headers.set("Idempotency-Key", value);
      } catch {
        continue;
      }
      assert.throws(
        () => resolveRoundRequestId(new Request("https://app.example/api/round", { headers })),
        (error: unknown) =>
          error instanceof AppError && error.status === 400 && error.code === "INVALID_IDEMPOTENCY_KEY",
      );
    }
  });
});
