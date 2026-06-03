import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../errors.ts";
import { csrfCookieName } from "../auth/constants.ts";
import { csrfHeaderName } from "./csrf-constants.ts";
import { requireMutationSecurity } from "./mutation.ts";

function request(headers: HeadersInit) {
  return new Request("https://app.example.test/api/mutate", {
    method: "POST",
    headers,
  });
}

describe("mutation security", () => {
  it("allows same-origin mutations with matching csrf token", () => {
    assert.doesNotThrow(() =>
      requireMutationSecurity(
        request({
          origin: "https://app.example.test",
          [csrfHeaderName]: "token-123",
          cookie: `${csrfCookieName}=token-123`,
        }),
      ),
    );
  });

  it("rejects cross-site mutations before csrf is considered", () => {
    assert.throws(
      () =>
        requireMutationSecurity(
          request({
            origin: "https://attacker.example",
            [csrfHeaderName]: "token-123",
            cookie: `${csrfCookieName}=token-123`,
          }),
        ),
      (error: unknown) => error instanceof AppError && error.status === 403 && error.code === "ORIGIN_MISMATCH",
    );
  });

  it("rejects same-origin mutations with missing or mismatched csrf token", () => {
    for (const headers of [
      new Headers({ origin: "https://app.example.test" }),
      new Headers({
        origin: "https://app.example.test",
        [csrfHeaderName]: "header-token",
        cookie: `${csrfCookieName}=cookie-token`,
      }),
    ]) {
      assert.throws(
        () => requireMutationSecurity(request(headers)),
        (error: unknown) => error instanceof AppError && error.status === 403 && error.code === "CSRF_INVALID",
      );
    }
  });
});
