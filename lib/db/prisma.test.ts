import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveDatabasePath } from "./prisma.ts";

describe("resolveDatabasePath", () => {
  afterEach(() => {
    delete process.env.DATABASE_URL;
  });

  it("defaults to ./dev.db when DATABASE_URL is missing, blank, or whitespace-only", () => {
    for (const value of [undefined, "", "   ", "\t\n  \r"]) {
      if (value === undefined) {
        delete process.env.DATABASE_URL;
      } else {
        process.env.DATABASE_URL = value;
      }

      assert.equal(resolveDatabasePath(), "./dev.db", `DATABASE_URL=${JSON.stringify(value)}`);
    }
  });

  it("trims valid DATABASE_URL values", () => {
    process.env.DATABASE_URL = "  ./custom.db  ";
    assert.equal(resolveDatabasePath(), "./custom.db");

    process.env.DATABASE_URL = "\n./trimmed.db\t";
    assert.equal(resolveDatabasePath(), "./trimmed.db");
  });

  it("strips file: prefix after trimming", () => {
    process.env.DATABASE_URL = "  file:./prod.db  ";
    assert.equal(resolveDatabasePath(), "./prod.db");

    process.env.DATABASE_URL = "file:   ./spaced.db   ";
    assert.equal(resolveDatabasePath(), "./spaced.db");
  });

  it("supports explicit input overrides without reading env", () => {
    process.env.DATABASE_URL = "file:./env.db";

    assert.equal(resolveDatabasePath("file:./override.db"), "./override.db");
    assert.equal(resolveDatabasePath("  ./input-trim.db  "), "./input-trim.db");
    assert.equal(resolveDatabasePath(""), "./dev.db");
    assert.equal(resolveDatabasePath("   "), "./dev.db");
    assert.equal(resolveDatabasePath(null), "./dev.db");
  });

  it("falls back when file: prefix leaves only whitespace", () => {
    assert.equal(resolveDatabasePath("file:   "), "./dev.db");
    assert.equal(resolveDatabasePath("file:\t"), "./dev.db");
  });

  it("preserves non-file paths and unusual but valid values after trimming", () => {
    assert.equal(resolveDatabasePath("./relative.db"), "./relative.db");
    assert.equal(resolveDatabasePath("C:\\Windows\\data.db"), "C:\\Windows\\data.db");
    assert.equal(resolveDatabasePath("file:./with?query=1"), "./with?query=1");
  });
});
