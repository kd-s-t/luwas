import type { ChatMessage, ChatThread } from "@/lib/ai/chatTypes";
import type { GeminiAssistModelId } from "@/lib/ai/geminiModels";
import { DEFAULT_GEMINI_MODEL, isGeminiAssistModel } from "@/lib/ai/geminiModels";

export const CHAT_STORAGE_KEY = "luwas.mangluluwas.history.v1";

export const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Kumusta — I’m Mangluluwas, your Luwas DRRM agent. Ask about the situation, or say “run triage” to prioritize households and draw escape routes on the map.",
  createdAt: new Date(0).toISOString(),
};

type StoredHistory = {
  activeId: string;
  threads: ChatThread[];
  model?: string;
};

export function newId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createThread(partial?: Partial<ChatThread>): ChatThread {
  const now = new Date().toISOString();
  return {
    id: partial?.id ?? newId(),
    title: partial?.title ?? "New chat",
    messages: partial?.messages ?? [{ ...WELCOME_MESSAGE, id: `welcome-${newId()}` }],
    result: partial?.result ?? null,
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
  };
}

export function titleFromMessages(messages: ChatMessage[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  const t = firstUser.content.replace(/\s+/g, " ").trim();
  if (t.length <= 42) return t;
  return `${t.slice(0, 42).trimEnd()}…`;
}

export function loadHistory(): {
  activeId: string;
  threads: ChatThread[];
  model: GeminiAssistModelId;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHistory;
    if (!Array.isArray(parsed.threads) || parsed.threads.length === 0) {
      return null;
    }
    const threads = parsed.threads
      .filter((t) => t && typeof t.id === "string" && Array.isArray(t.messages))
      .map((t) => ({
        ...t,
        title: t.title || titleFromMessages(t.messages),
        result: t.result ?? null,
        createdAt: t.createdAt ?? new Date().toISOString(),
        updatedAt: t.updatedAt ?? t.createdAt ?? new Date().toISOString(),
      }));
    if (!threads.length) return null;
    const activeId = threads.some((t) => t.id === parsed.activeId)
      ? parsed.activeId
      : threads[0].id;
    const model =
      typeof parsed.model === "string" && isGeminiAssistModel(parsed.model)
        ? parsed.model
        : DEFAULT_GEMINI_MODEL;
    return { activeId, threads, model };
  } catch {
    return null;
  }
}

export function saveHistory(state: {
  activeId: string;
  threads: ChatThread[];
  model: GeminiAssistModelId;
}) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredHistory = {
      activeId: state.activeId,
      threads: state.threads.slice(0, 40),
      model: state.model,
    };
    window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
