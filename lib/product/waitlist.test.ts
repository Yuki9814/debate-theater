import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { summarizeWaitlistLeads, waitlistLeadsToCsv } from "./waitlist.ts";

describe("waitlist reporting", () => {
  const leads = [
    {
      id: "1",
      moduleId: "persona",
      email: "reader@example.com",
      useCase: "角色辩论",
      createdAt: new Date("2026-01-02T00:00:00.000Z"),
    },
    {
      id: "2",
      moduleId: "research",
      email: "ops@example.com",
      useCase: "热点资料",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    },
  ];

  it("summarizes lead counts by roadmap module", () => {
    const summary = summarizeWaitlistLeads(leads);
    assert.equal(summary.find((item) => item.moduleId === "persona")?.count, 1);
    assert.equal(summary.find((item) => item.moduleId === "research")?.latestUseCases[0]?.email, "ops@example.com");
  });

  it("exports CSV with escaped cells", () => {
    const csv = waitlistLeadsToCsv([
      {
        id: "3",
        moduleId: "companion",
        email: "a@example.com",
        useCase: 'needs "quotes"',
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
    assert.match(csv, /"needs ""quotes"""/);
  });
});
