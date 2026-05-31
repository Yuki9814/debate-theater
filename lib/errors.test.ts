import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { AppError, errorResponse } from "./errors.ts";

describe("errorResponse", () => {
  it("preserves AppError message and code", async () => {
    const response = errorResponse(new AppError("App specific error", 403, "FORBIDDEN"), "fallback");
    const data = await response.json();

    assert.equal(response.status, 403);
    assert.deepEqual(data, {
      error: "App specific error",
      code: "FORBIDDEN"
    });
  });

  it("preserves ZodError first issue message", async () => {
    const response = errorResponse(
      new ZodError([{ code: "custom", path: ["name"], message: "Name must be a string" }]),
      "fallback",
      400
    );
    const data = await response.json();

    assert.equal(response.status, 400);
    assert.deepEqual(data, {
      error: "Name must be a string",
      code: "VALIDATION_ERROR"
    });
  });

  it("does not leak generic Error messages", async () => {
    const response = errorResponse(new Error("database password leaked"), "Safe fallback message", 500);
    const data = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(data, {
      error: "Safe fallback message",
      code: "REQUEST_FAILED"
    });
  });

  it("uses fallback for unknown error types", async () => {
    const response = errorResponse({ some: "object" }, "Safe fallback message", 500);
    const data = await response.json();

    assert.equal(response.status, 500);
    assert.deepEqual(data, {
      error: "Safe fallback message",
      code: "REQUEST_FAILED"
    });
  });
});
