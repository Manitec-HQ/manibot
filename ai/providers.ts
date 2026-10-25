import { groq } from "@ai-sdk/groq";
import { customProvider } from "ai";

const languageModels = {
  "openai/gpt-oss-20b": groq("openai/gpt-oss-20b"),
  "llama-3.3-70b-versatile": groq("llama-3.3-70b-versatile"),
  "llama-3.1-8b-instant": groq("llama-3.1-8b-instant"),
};

export const model = customProvider({ languageModels });
export type modelID = keyof typeof languageModels;
export const MODELS = Object.keys(languageModels) as modelID[];
export const defaultModel: modelID = "openai/gpt-oss-20b";
