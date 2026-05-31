export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateTextInput = {
  model?: string | null;
  messages: AIMessage[];
  temperature?: number;
  metadata?: Record<string, string | number | boolean | null | undefined>;
};

export interface AIProvider {
  id: string;
  name: string;
  generateText(input: GenerateTextInput): Promise<string>;
  generateJSON<T>(input: GenerateTextInput, schema?: unknown): Promise<T>;
}
