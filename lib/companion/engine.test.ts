import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { companionCreateSchema } from "./engine.ts";

describe("companion engine input", () => {
  it("requires a principal, companion, and meaningful goal", () => {
    const parsed = companionCreateSchema.parse({
      principalName: "岳飞",
      companionName: "诸葛亮",
      goal: "避免风波亭遗憾。",
    });

    assert.equal(parsed.principalName, "岳飞");
    assert.throws(() =>
      companionCreateSchema.parse({
        principalName: "",
        companionName: "诸葛亮",
        goal: "短",
      }),
    );
  });
});
