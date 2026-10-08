"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssistEscapeRoute,
  AssistPriority,
  AssistResult,
} from "@/lib/ai/assistTypes";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import type {
  ChatApiResponse,
  ChatMessage,
  ChatThread,
  SmsLogEntry,
} from "@/lib/ai/chatTypes";
import {
  createThread,
  loadHistory,
  newId,
  saveHistory,
  titleFromMessages,
} from "@/lib/ai/chatHistory";
import {
  DEFAULT_GEMINI_MODEL,
  type GeminiAssistModelId,
} from "@/lib/ai/geminiModels";
import {
  isSmsDispatchIntent,
  smsPriorityFromIntent,
} from "@/lib/alerts/smsIntent";
import { enrichEscapesWithRoads } from "@/lib/geo/osrmRoute";
import type { FloodSample } from "@/lib/hazards/floodSamples";
import type { LandslideSample } from "@/lib/hazards/landslideSamples";
import type { TyphoonSample } from "@/lib/hazards/typhoonSamples";
import type { Household } from "@/lib/households/types";

export type AssistPayload = {
  households: Household[];
  floods: FloodSample[];
  landslides: LandslideSample[];
  typhoons: TyphoonSample[];
  weatherLabel?: string;
  model?: GeminiAssistModelId;
};

function bootstrap() {
  const first = createThread();
  return { activeId: first.id, threads: [first] as ChatThread[] };
}

export function useAiAssist() {
  const boot = useMemo(() => bootstrap(), []);
  const [hydrated, setHydrated] = useState(false);
  const [threads, setThreads] = useState<ChatThread[]>(boot.threads);
  const [activeId, setActiveId] = useState(boot.activeId);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<GeminiAssistModelId>(DEFAULT_GEMINI_MODEL);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const resultRef = useRef<AssistResult | null>(null);

  useEffect(() => {
    const stored = loadHistory();
    if (stored) {
      setThreads(stored.threads);
      setActiveId(stored.activeId);
      setModel(stored.model);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveHistory({ activeId, threads, model });
  }, [activeId, threads, model, hydrated]);

  const active = useMemo(
    () => threads.find((t) => t.id === activeId) ?? threads[0],
    [threads, activeId],
  );

  const messages = active?.messages ?? [];
  const result = active?.result ?? null;
  resultRef.current = result;

  const assistPriorities = useMemo(() => {
    const map: Record<string, AssistPriority> = {};
    if (!result) return map;
    for (const a of result.actions) {
      map[a.householdId] = a.priority;
    }
    return map;
  }, [result]);

  const escapeRoutes = useMemo((): AssistEscapeRoute[] => {
    return result?.escapes ?? [];
  }, [result]);

  const patchActive = useCallback(
    (updater: (thread: ChatThread) => ChatThread) => {
      const id = activeIdRef.current;
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? updater(t) : t)),
      );
    },
    [],
  );

  const applyAssist = useCallback(
    async (assist: AssistResult, households: Household[] = []) => {
      const withContacts: AssistResult = {
        ...assist,
        actions: enrichActionsWithContacts(assist.actions, households),
      };
      patchActive((t) => ({
        ...t,
        result: withContacts,
        updatedAt: new Date().toISOString(),
      }));
      if (!withContacts.escapes?.length) return withContacts;

      const routed = await enrichEscapesWithRoads(withContacts.escapes);
      const routedN = routed.filter((e) => e.routed).length;
      const next: AssistResult = {
        ...withContacts,
        escapes: routed,
        mapHint:
          routedN > 0
            ? "Green lines follow OSM streets to the nearest safe point."
            : withContacts.mapHint,
        summary:
          routedN > 0
            ? `${withContacts.summary} Escape paths routed along roads (${routedN}).`
            : withContacts.summary,
      };
      patchActive((t) => ({
        ...t,
        result: next,
        updatedAt: new Date().toISOString(),
      }));
      return next;
    },
    [patchActive],
  );

  const dispatchSmsFromAssist = useCallback(
    async (
      priority: "evacuate" | "evacuate_and_prepare",
      households: Household[],
    ): Promise<{ reply: string; smsLog: SmsLogEntry[] }> => {
      const assist = resultRef.current;
      if (!assist?.actions.length) {
        throw new Error("No triage list yet — ask Mangluluwas to run triage first.");
      }
      const enriched = enrichActionsWithContacts(assist.actions, households);
      const res = await fetch("/api/alerts/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority,
          barangay: "Brgy. Nangka",
          recipients: enriched.map((a) => ({
            householdId: a.householdId,
            ownerName: a.ownerName,
            phone: a.phone,
            purok: a.purok,
            priority: a.priority,
          })),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        provider?: string;
        sent?: number;
        failed?: number;
        skipped?: { ownerName?: string; reason: string }[];
        truncated?: boolean;
        results?: SmsLogEntry[];
      };
      if (!res.ok) {
        throw new Error(data.error || `SMS failed (${res.status})`);
      }
      const smsLog: SmsLogEntry[] = (data.results ?? []).map((r) => ({
        to: r.to,
        ok: r.ok,
        ownerName: r.ownerName,
        phoneDisplay: r.phoneDisplay ?? r.to,
        priority: r.priority,
        body: r.body,
        error: r.error,
        provider: r.provider ?? data.provider,
      }));
      const skipN = data.skipped?.length ?? 0;
      const sentN = data.sent ?? smsLog.filter((r) => r.ok).length;
      const lines = [
        data.provider === "demo"
          ? `Demo SMS · ${sentN} message(s) logged (set TWILIO_* env for live Twilio).`
          : `Twilio SMS · sent ${sentN}${data.failed ? ` · failed ${data.failed}` : ""}.`,
      ];
      if (skipN) lines.push(`Skipped ${skipN} (no/bad phone).`);
      const fails = smsLog.filter((r) => !r.ok).slice(0, 3);
      for (const f of fails) {
        lines.push(`· ${f.to}: ${f.error ?? "failed"}`);
      }
      return { reply: lines.join("\n"), smsLog };
    },
    [],
  );

  const sendMessage = useCallback(
    async (text: string, payload: AssistPayload) => {
      const trimmed = text.trim();
      if (!trimmed || running) return;

      const threadId = activeIdRef.current;
      const userMsg: ChatMessage = {
        id: newId(),
        role: "user",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };

      let historySnapshot: ChatMessage[] = [];
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id !== threadId) return t;
          const nextMessages = [...t.messages, userMsg];
          historySnapshot = nextMessages;
          return {
            ...t,
            messages: nextMessages,
            title:
              t.title === "New chat"
                ? titleFromMessages(nextMessages)
                : t.title,
            updatedAt: new Date().toISOString(),
          };
        }),
      );

      setRunning(true);
      setError(null);

      try {
        if (isSmsDispatchIntent(trimmed)) {
          const { reply, smsLog } = await dispatchSmsFromAssist(
            smsPriorityFromIntent(trimmed),
            payload.households,
          );
          const assistantMsg: ChatMessage = {
            id: newId(),
            role: "assistant",
            content: reply,
            smsLog,
            createdAt: new Date().toISOString(),
          };
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== threadId) return t;
              return {
                ...t,
                messages: [...t.messages, assistantMsg],
                result: null,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
          resultRef.current = null;
          return;
        }

        const history = historySnapshot
          .filter((m) => !m.id.startsWith("welcome"))
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history,
            model: payload.model ?? model,
            households: payload.households,
            floods: payload.floods,
            landslides: payload.landslides,
            typhoons: payload.typhoons,
            weatherLabel: payload.weatherLabel,
          }),
        });
        if (!res.ok) {
          throw new Error(`Chat failed (${res.status})`);
        }

        const data = (await res.json()) as ChatApiResponse;
        let assistApplied = false;
        let nextResult: AssistResult | null | undefined;

        if (data.assist) {
          await applyAssist(data.assist, payload.households);
          assistApplied = true;
        } else if (
          /\b(clear|reset|remove)\b.*\b(highlight|map|pin|assist)\b/i.test(
            trimmed,
          )
        ) {
          nextResult = null;
        }

        const assistantMsg: ChatMessage = {
          id: newId(),
          role: "assistant",
          content: data.reply,
          assistApplied,
          createdAt: new Date().toISOString(),
        };

        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== threadId) return t;
            return {
              ...t,
              messages: [...t.messages, assistantMsg],
              result: nextResult === null ? null : t.result,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Chat failed";
        setError(msg);
        setThreads((prev) =>
          prev.map((t) => {
            if (t.id !== threadId) return t;
            return {
              ...t,
              messages: [
                ...t.messages,
                {
                  id: newId(),
                  role: "assistant",
                  content: `Sorry — I couldn’t reach the agent (${msg}).`,
                  createdAt: new Date().toISOString(),
                },
              ],
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      } finally {
        setRunning(false);
      }
    },
    [applyAssist, dispatchSmsFromAssist, model, running],
  );

  const clearAssist = useCallback(() => {
    setError(null);
    patchActive((t) => ({
      ...t,
      result: null,
      updatedAt: new Date().toISOString(),
    }));
  }, [patchActive]);

  const newChat = useCallback(() => {
    if (running) return;
    const thread = createThread();
    setThreads((prev) => [thread, ...prev]);
    setActiveId(thread.id);
    setError(null);
  }, [running]);

  const selectChat = useCallback(
    (id: string) => {
      if (running) return;
      setActiveId(id);
      setError(null);
    },
    [running],
  );

  const deleteChat = useCallback(
    (id: string) => {
      if (running) return;
      setThreads((prev) => {
        const next = prev.filter((t) => t.id !== id);
        if (next.length === 0) {
          const fresh = createThread();
          setActiveId(fresh.id);
          return [fresh];
        }
        if (id === activeIdRef.current) {
          setActiveId(next[0].id);
        }
        return next;
      });
      setError(null);
    },
    [running],
  );

  const renameChat = useCallback((id: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, title: trimmed.slice(0, 80), updatedAt: new Date().toISOString() }
          : t,
      ),
    );
  }, []);

  const threadSummaries = useMemo(
    () =>
      [...threads]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        )
        .map((t) => ({
          id: t.id,
          title: t.title,
          updatedAt: t.updatedAt,
          preview:
            [...t.messages]
              .reverse()
              .find((m) => m.role === "user" || m.role === "assistant")
              ?.content ?? "",
        })),
    [threads],
  );

  return {
    running,
    messages,
    result,
    error,
    model,
    setModel,
    activeChatId: activeId,
    chats: threadSummaries,
    assistPriorities,
    escapeRoutes,
    sendMessage,
    clearAssist,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
  };
}
