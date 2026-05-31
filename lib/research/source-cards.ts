export type SourceCard = {
  title: string;
  url: string;
  sourceName: string;
  publishedTime: string;
  summary: string;
  reliabilityNote: string;
};

export async function collectNeutralSourceCards(topic: string): Promise<SourceCard[]> {
  void topic;
  return [];
}

export const hotTopicResearchStub = {
  enabled: false,
  note: "Phase 2 will collect neutral source cards and share the same research pack with both debaters.",
};
