import { GoogleGenAI } from "@google/genai";
import {
  DEFAULT_GEMINI_MODEL,
  type GeminiAssistModelId,
} from "@/lib/ai/geminiModels";

/** Prefer selected model, then stable fallbacks when 503/404. */
const FALLBACK_MODELS: GeminiAssistModelId[] = [
  DEFAULT_GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash",
];

export type GeminiGenerateResult = {
  text: string;
  model: GeminiAssistModelId;
};

export async function generateWithGeminiFallback(
  apiKey: string,
  preferred: GeminiAssistModelId,
  contents: string,
): Promise<GeminiGenerateResult> {
  const ai = new GoogleGenAI({ apiKey });
  const tried = new Set<string>();
  const order = [preferred, ...FALLBACK_MODELS.filter((m) => m !== preferred)];
  let lastError: unknown;

  for (const model of order) {
    if (tried.has(model)) continue;
    tried.add(model);
    try {
      const response = await ai.models.generateContent({ model, contents });
      const text = response.text ?? "";
      if (!text.trim()) {
        lastError = new Error(`Empty response from ${model}`);
        continue;
      }
      return { text, model };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini unavailable");
}
