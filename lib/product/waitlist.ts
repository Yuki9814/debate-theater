import { roadmapModules } from "./conversion.ts";

export type WaitlistLeadView = {
  id: string;
  moduleId: string;
  email: string;
  useCase: string;
  createdAt: Date | string;
};

export function summarizeWaitlistLeads(leads: WaitlistLeadView[]) {
  return roadmapModules.map((module) => {
    const moduleLeads = leads.filter((lead) => lead.moduleId === module.id);
    return {
      moduleId: module.id,
      title: module.title,
      count: moduleLeads.length,
      latestUseCases: moduleLeads
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map((lead) => ({
          email: lead.email,
          useCase: lead.useCase,
          createdAt: new Date(lead.createdAt).toISOString(),
        })),
    };
  });
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function waitlistLeadsToCsv(leads: WaitlistLeadView[]) {
  const rows = [
    ["id", "moduleId", "email", "useCase", "createdAt"],
    ...leads.map((lead) => [
      lead.id,
      lead.moduleId,
      lead.email,
      lead.useCase,
      new Date(lead.createdAt).toISOString(),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}
