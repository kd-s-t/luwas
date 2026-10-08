import type { AssistResult } from "@/lib/ai/assistTypes";

export type ChatRole = "user" | "assistant";

export type SmsLogEntry = {
  to: string;
  ok: boolean;
  ownerName?: string;
  phoneDisplay?: string;
  priority?: string;
  body?: string;
  error?: string;
  provider?: string;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  /** Set when this assistant turn also updated the map. */
  assistApplied?: boolean;
  /** SMS blast log for clickable “N message(s)” in the reply. */
  smsLog?: SmsLogEntry[];
  createdAt?: string;
};

/** One Cursor-style chat thread. */
export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  /** Last map assist applied in this thread (restored on switch). */
  result: AssistResult | null;
  createdAt: string;
  updatedAt: string;
};

export type ChatApiResponse = {
  reply: string;
  source: "gemini" | "local";
  model?: string;
  /** Present when the agent ran triage / map updates. */
  assist: AssistResult | null;
};
