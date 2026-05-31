import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { runNextRound } from "./engine.ts";
import { prisma } from "../db/prisma.ts";

describe("runNextRound Concurrency Guard", () => {
  it("prevents concurrent executions for the same session", async () => {
    const sessionId = "test-session-id";

    const mockSession = {
      id: sessionId,
      userId: "user-id",
      status: "running",
      currentRound: 1,
      maxRounds: 10,
      pauseEveryRounds: 5,
      lowScoreThreshold: 55,
      consecutiveLowLimit: 3,
      judgeConfidence: 0.75,
      topic: "Test Topic",
      createdAt: new Date(),
      updatedAt: new Date(),
      participants: [
        { side: "A", modelProviderId: "mock", stance: "A", systemPrompt: "A" },
        { side: "B", modelProviderId: "mock", stance: "B", systemPrompt: "B" },
        { side: "Judge", modelProviderId: "mock", stance: "J", systemPrompt: "J" },
      ],
      rounds: [],
    };

    try {
      mock.method(prisma.debateSession, "findUnique", async () => mockSession);
      const createRoundMock = mock.method(prisma.debateRound, "create", async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return { id: "round-id", createdAt: new Date(), scores: [] };
      });

      mock.method(prisma.debateSession, "update", async () => mockSession);

      const [res1, res2] = await Promise.all([
        runNextRound(sessionId),
        runNextRound(sessionId)
      ]);

      assert.ok(res1);
      assert.ok(res2);
      assert.strictEqual(createRoundMock.mock.callCount(), 1);
    } finally {
      mock.restoreAll();
    }
  });
});
