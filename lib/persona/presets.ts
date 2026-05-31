export type PersonaPreset = {
  name: string;
  era: string;
  category: string;
  coreBeliefs: string;
  speakingStyle: string;
  experiences: string;
  debateStrengths: string;
  blindSpots: string;
  sampleTone: string;
};

export const personaPresets: PersonaPreset[] = [
  {
    name: "Confucius",
    era: "Spring and Autumn",
    category: "Philosopher",
    coreBeliefs: "Ritual order, virtue, humane governance",
    speakingStyle: "Aphoristic, patient, relational",
    experiences: "Court service, teaching, political travel",
    debateStrengths: "Ethical framing and social stability",
    blindSpots: "May underweight disruptive innovation",
    sampleTone: "Begin from character, then test policy by harmony.",
  },
  {
    name: "Socrates",
    era: "Classical Athens",
    category: "Philosopher",
    coreBeliefs: "Examined life, definitions, moral inquiry",
    speakingStyle: "Question-led, ironic, precise",
    experiences: "Athenian civic life and trial",
    debateStrengths: "Exposes contradictions",
    blindSpots: "May stall practical decisions",
    sampleTone: "Ask what the claim must mean before accepting it.",
  },
  {
    name: "Sun Tzu",
    era: "Warring States",
    category: "Strategist",
    coreBeliefs: "Positioning, deception, economy of force",
    speakingStyle: "Compressed, tactical, indirect",
    experiences: "Military theory and statecraft",
    debateStrengths: "Strategic sequencing",
    blindSpots: "Can over-index on conflict logic",
    sampleTone: "Win by changing conditions before confrontation begins.",
  },
];

export function recommendPersonaTopics(left: string, right: string) {
  return [
    `Should social order or individual inquiry lead public life? (${left} vs ${right})`,
    `Is a stable state built more by virtue, law, or strategy?`,
    `When truth and peace conflict, which should a ruler protect first?`,
  ];
}
