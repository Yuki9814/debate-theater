import { z } from "zod";
import { prisma } from "../db/prisma.ts";

export const companionCreateSchema = z.object({
  principalName: z.string().trim().min(1).max(80),
  companionName: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(4).max(800),
});

export type CompanionCreateInput = z.infer<typeof companionCreateSchema>;

export type CompanionNodeDTO = {
  id: string;
  sequence: number;
  nodeType: string;
  title: string;
  body: string;
  riskLevel: string;
  createdAt: string;
};

export type CompanionSessionDTO = {
  id: string;
  title: string;
  principalName: string;
  companionName: string;
  goal: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  nodes: CompanionNodeDTO[];
};

function serializeCompanionSession(session: {
  id: string;
  title: string;
  principalName: string;
  companionName: string;
  goal: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  nodes: Array<{
    id: string;
    sequence: number;
    nodeType: string;
    title: string;
    body: string;
    riskLevel: string;
    createdAt: Date;
  }>;
}): CompanionSessionDTO {
  return {
    ...session,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    nodes: session.nodes.map((node) => ({
      ...node,
      createdAt: node.createdAt.toISOString(),
    })),
  };
}

function initialNodes(input: CompanionCreateInput) {
  return [
    {
      sequence: 1,
      nodeType: "historical_fact",
      title: "史实基线",
      body: `${input.principalName}所处的历史困局先被锁定为不可随意改写的基线；同行者${input.companionName}只能在已知约束内提供建议。`,
      riskLevel: "low",
    },
    {
      sequence: 2,
      nodeType: "reasonable_inference",
      title: "可干预窗口",
      body: `围绕“${input.goal}”，系统先寻找低破坏度行动：信息传递、联盟修补、资源调度、关键人物劝说。`,
      riskLevel: "medium",
    },
    {
      sequence: 3,
      nodeType: "fictional_branch",
      title: "分支假设",
      body: `若${input.companionName}成功进入${input.principalName}的世界线，第一分支将测试“最小改变能否撬动遗憾结果”。`,
      riskLevel: "high",
    },
  ];
}

function nextNode(session: CompanionSessionDTO) {
  const nextSequence = session.nodes.length + 1;
  const nodeType =
    nextSequence % 3 === 1
      ? "historical_fact"
      : nextSequence % 3 === 2
        ? "reasonable_inference"
        : "fictional_branch";
  const riskLevel = nodeType === "historical_fact" ? "low" : nodeType === "reasonable_inference" ? "medium" : "high";
  return {
    sequence: nextSequence,
    nodeType,
    title: `第 ${nextSequence} 节点：${nodeType === "historical_fact" ? "事实校准" : nodeType === "reasonable_inference" ? "策略推进" : "分支后果"}`,
    body:
      nodeType === "historical_fact"
        ? `重新核对${session.principalName}的时代限制，避免${session.companionName}用后世知识直接碾压历史。`
        : nodeType === "reasonable_inference"
          ? `${session.companionName}提出一项低暴露度建议：先改变决策信息，再改变行动顺序，以服务“${session.goal}”。`
          : `世界线出现新分支：目标可能被推进，但代价会转移到盟友信任、资源消耗或后续政治合法性。`,
    riskLevel,
  };
}

export async function createCompanionSession(userId: string, rawInput: unknown) {
  const input = companionCreateSchema.parse(rawInput);
  const session = await prisma.companionSession.create({
    data: {
      userId,
      title: `${input.companionName}入局${input.principalName}`,
      principalName: input.principalName,
      companionName: input.companionName,
      goal: input.goal,
      nodes: { create: initialNodes(input) },
    },
  });
  return serializeCompanionSession(session);
}

export async function listCompanionSessions(userId: string) {
  const sessions = await prisma.companionSession.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
  });
  return sessions.map(serializeCompanionSession);
}

export async function advanceCompanionSession(userId: string, sessionId: string) {
  const session = await prisma.companionSession.findUnique({ where: { id: sessionId, userId } });
  if (!session) throw new Error("未找到同行者世界线。");
  const serialized = serializeCompanionSession(session);
  await prisma.companionNode.create({
    data: {
      companionSessionId: sessionId,
      ...nextNode(serialized),
    },
  });
  const updated = await prisma.companionSession.findUnique({ where: { id: sessionId, userId } });
  if (!updated) throw new Error("未找到同行者世界线。");
  return serializeCompanionSession(updated);
}

export async function rollbackCompanionSession(userId: string, sessionId: string) {
  const session = await prisma.companionSession.findUnique({ where: { id: sessionId, userId } });
  if (!session) throw new Error("未找到同行者世界线。");
  if (session.nodes.length <= 1) return serializeCompanionSession(session);
  await prisma.companionNode.deleteLatest({ where: { companionSessionId: sessionId } });
  const updated = await prisma.companionSession.findUnique({ where: { id: sessionId, userId } });
  if (!updated) throw new Error("未找到同行者世界线。");
  return serializeCompanionSession(updated);
}
