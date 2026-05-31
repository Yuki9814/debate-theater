import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getPersonaPreset, personaPresets, recommendPersonaTopics } from "./presets.ts";

describe("persona presets", () => {
  it("ships a broad first library of Chinese-ready personas", () => {
    assert.ok(personaPresets.length >= 30);
    assert.equal(new Set(personaPresets.map((persona) => persona.id)).size, personaPresets.length);
    assert.ok(getPersonaPreset("confucius")?.name.includes("孔子"));
  });

  it("recommends concrete topics for a pair", () => {
    const topics = recommendPersonaTopics("孔子", "韩非子");
    assert.ok(topics.length >= 3);
    assert.ok(topics.every((topic) => topic.includes("孔子") || topic.includes("韩非子")));
  });
});
