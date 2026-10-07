/** Text models suitable for DRRM JSON assist (not Live / TTS / image / video). */
export const GEMINI_ASSIST_MODELS = [
  {
    id: "gemini-3.5-flash",
    label: "Gemini 3.5 Flash",
    hint: "Recommended · stable",
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    hint: "Balanced",
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    hint: "Fast · cheap",
  },
  {
    id: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    hint: "Reliable fallback",
  },
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    hint: "Latest · may be busy",
  },
  {
    id: "gemini-3.7-flash",
    label: "Gemini 3.7 Flash",
    hint: "Previous gen",
  },
  {
    id: "gemini-3.1-flash-lite",
    label: "Gemini 3.1 Flash-Lite",
    hint: "Cost efficient",
  },
  {
    id: "gemini-3-flash-preview",
    label: "Gemini 3 Flash",
    hint: "Preview",
  },
  {
    id: "gemini-3.1-pro-preview",
    label: "Gemini 3.1 Pro",
    hint: "Deeper reasoning",
  },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite",
    hint: "Legacy · may 404",
  },
] as const;

export type GeminiAssistModelId = (typeof GEMINI_ASSIST_MODELS)[number]["id"];

/** Cheapest stable default — Flash-Lite; avoid 2.5 Flash-Lite (may 404). */
export const DEFAULT_GEMINI_MODEL: GeminiAssistModelId = "gemini-3.5-flash-lite";

const ALLOWED = new Set<string>(GEMINI_ASSIST_MODELS.map((m) => m.id));

export function isGeminiAssistModel(id: string): id is GeminiAssistModelId {
  return ALLOWED.has(id);
}

export function resolveGeminiModel(id: unknown): GeminiAssistModelId {
  if (typeof id === "string" && isGeminiAssistModel(id)) return id;
  return DEFAULT_GEMINI_MODEL;
}

export function geminiModelLabel(id: string): string {
  const found = GEMINI_ASSIST_MODELS.find((m) => m.id === id);
  return found?.label ?? id;
}
