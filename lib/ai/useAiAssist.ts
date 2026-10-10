"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AssistEscapeRoute,
  AssistPriority,
  AssistResult,
} from "@/lib/ai/assistTypes";
import { predictAiFloods } from "@/lib/ai/predictFloods";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import {
  clearBarangayMapSnapshot,
  saveBarangayMapSnapshot,
} from "@/lib/ai/barangayMapSnapshot";
import { DEFAULT_MAP_AREA } from "@/lib/geo/mapAreas";
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
  callPriorityFromIntent,
  isCallDispatchIntent,
} from "@/lib/alerts/callIntent";
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
  const callListVisible = Boolean(active?.callListVisible && result);
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

  // Keep homepage Nangka map in sync with the active command triage overlay.
  useEffect(() => {
    if (!hydrated) return;
    if (result?.actions.length || result?.predictedFloods?.length) {
      saveBarangayMapSnapshot(DEFAULT_MAP_AREA.id, result);
    }
  }, [hydrated, result]);

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
    async (
      assist: AssistResult,
      households: Household[] = [],
      typhoons: TyphoonSample[] = [],
    ) => {
      // Run triage always paints AI flood footprints on the map.
      const floods =
        assist.predictedFloods?.length && assist.predictedFloods.length > 0
          ? assist.predictedFloods
          : predictAiFloods({ typhoons, source: assist.source });
      const withContacts: AssistResult = {
        ...assist,
        predictedFloods: floods,
        actions: enrichActionsWithContacts(assist.actions, households),
        mapHint:
          assist.mapHint ||
          "AI flood footprints on map. Run triage sets predicted flood areas.",
      };
      patchActive((t) => ({
        ...t,
        result: withContacts,
        callListVisible: true,
        updatedAt: new Date().toISOString(),
      }));
      if (!withContacts.escapes?.length) {
        saveBarangayMapSnapshot(DEFAULT_MAP_AREA.id, withContacts, households);
        return withContacts;
      }

      const routed = await enrichEscapesWithRoads(withContacts.escapes);
      const routedN = routed.filter((e) => e.routed).length;
      const next: AssistResult = {
        ...withContacts,
        escapes: routed,
        predictedFloods: floods,
        mapHint:
          routedN > 0
            ? "AI flood footprints on map · red lines follow streets to safe points."
            : withContacts.mapHint,
        summary:
          routedN > 0
            ? `${withContacts.summary} Escape paths routed along roads (${routedN}).`
            : withContacts.summary,
      };
      patchActive((t) => ({
        ...t,
        result: next,
        callListVisible: true,
        updatedAt: new Date().toISOString(),
      }));
      saveBarangayMapSnapshot(DEFAULT_MAP_AREA.id, next, households);
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
            email: a.email,
            purok: a.purok,
            priority: a.priority,
          })),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        provider?: string | { sms?: string; email?: string };
        sent?: number;
        failed?: number;
        smsAttempted?: number;
        emailAttempted?: number;
        skipped?: { ownerName?: string; reason: string }[];
        truncated?: boolean;
        results?: SmsLogEntry[];
      };
      if (!res.ok) {
        throw new Error(data.error || `Alert failed (${res.status})`);
      }
      const smsLog: SmsLogEntry[] = (data.results ?? []).map((r) => ({
        to: r.to,
        ok: r.ok,
        channel: r.channel ?? "sms",
        ownerName: r.ownerName,
        phoneDisplay: r.phoneDisplay ?? (r.channel === "email" ? undefined : r.to),
        emailDisplay: r.emailDisplay ?? (r.channel === "email" ? r.to : undefined),
        priority: r.priority,
        subject: r.subject,
        body: r.body,
        error: r.error,
        provider: r.provider,
      }));
      const skipN = data.skipped?.length ?? 0;
      const smsN = smsLog.filter((r) => r.channel !== "email" && r.ok).length;
      const emailN = smsLog.filter((r) => r.channel === "email" && r.ok).length;
      const smsProv =
        typeof data.provider === "object" ? data.provider.sms : data.provider;
      const emailProv =
        typeof data.provider === "object" ? data.provider.email : undefined;
      const lines: string[] = [];
      if (data.smsAttempted || smsN) {
        lines.push(
          smsProv === "demo"
            ? `Odette simulation · ${smsN} SMS logged.`
            : `Semaphore SMS · sent ${smsN}${data.failed ? ` · some failed` : ""}.`,
        );
      }
      if (data.emailAttempted || emailN) {
        lines.push(
          emailProv === "demo"
            ? `Odette simulation · ${emailN} email(s) logged.`
            : `Resend email · sent ${emailN}.`,
        );
      }
      if (!lines.length) {
        lines.push(`Alerts · ${data.sent ?? smsLog.filter((r) => r.ok).length} sent.`);
      }
      if (skipN) lines.push(`Skipped ${skipN} (no/bad phone or email).`);
      const fails = smsLog.filter((r) => !r.ok).slice(0, 3);
      for (const f of fails) {
        lines.push(`· ${f.to}: ${f.error ?? "failed"}`);
      }
      const total = smsLog.filter((r) => r.ok).length;
      if (total > 0) {
        lines.unshift(`${total} message(s) via available contacts (SMS and/or email).`);
      }
      return { reply: lines.join("\n"), smsLog };
    },
    [],
  );

  const dispatchCallFromAssist = useCallback(
    async (
      priority: "evacuate" | "evacuate_and_prepare",
      households: Household[],
    ): Promise<{ reply: string; smsLog: SmsLogEntry[] }> => {
      const assist = resultRef.current;
      if (!assist?.actions.length) {
        throw new Error("No triage list yet — ask Mangluluwas to run triage first.");
      }
      const enriched = enrichActionsWithContacts(assist.actions, households);
      const res = await fetch("/api/alerts/call", {
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
        provider?: { call?: string };
        sent?: number;
        failed?: number;
        callAttempted?: number;
        skipped?: { ownerName?: string; reason: string }[];
        results?: SmsLogEntry[];
      };
      if (!res.ok) {
        throw new Error(data.error || `Call failed (${res.status})`);
      }
      const smsLog: SmsLogEntry[] = (data.results ?? []).map((r) => ({
        to: r.to,
        ok: r.ok,
        channel: "call",
        ownerName: r.ownerName,
        phoneDisplay: r.phoneDisplay ?? r.to,
        priority: r.priority,
        body: r.body,
        error: r.error,
        provider: r.provider,
      }));
      const callN = smsLog.filter((r) => r.ok).length;
      const skipN = data.skipped?.length ?? 0;
      const callProv = data.provider?.call;
      const lines: string[] = [];
      if (callN > 0) {
        lines.push(`${callN} call(s) via available phones.`);
      }
      lines.push(
        callProv === "demo"
          ? `Odette simulation · ${callN} call(s) logged.`
          : `Twilio Voice · dialed ${callN}${data.failed ? ` · some failed` : ""}.`,
      );
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
        if (isCallDispatchIntent(trimmed)) {
          const { reply, smsLog } = await dispatchCallFromAssist(
            callPriorityFromIntent(trimmed),
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
                callListVisible: false,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
          return;
        }

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
          // After SMS: hide evacuate list only — map colors / floods stay.
          setThreads((prev) =>
            prev.map((t) => {
              if (t.id !== threadId) return t;
              return {
                ...t,
                messages: [...t.messages, assistantMsg],
                callListVisible: false,
                updatedAt: new Date().toISOString(),
              };
            }),
          );
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
          await applyAssist(
            data.assist,
            payload.households,
            payload.typhoons,
          );
          assistApplied = true;
        } else if (
          /\b(clear|reset|remove)\b.*\b(highlight|map|pin|assist|flood)\b/i.test(
            trimmed,
          )
        ) {
          // Explicit “clear map” in chat — remove overlays.
          nextResult = null;
          clearBarangayMapSnapshot(DEFAULT_MAP_AREA.id);
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
              callListVisible:
                nextResult === null
                  ? false
                  : assistApplied
                    ? true
                    : t.callListVisible,
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
    [applyAssist, dispatchCallFromAssist, dispatchSmsFromAssist, model, running],
  );

  /** Hide evacuate / prepare list only — map dots + AI floods stay. */
  const clearCallList = useCallback(() => {
    setError(null);
    patchActive((t) => ({
      ...t,
      callListVisible: false,
      updatedAt: new Date().toISOString(),
    }));
  }, [patchActive]);

  /** Full map reset (chat “clear map” / rare). */
  const clearAssist = useCallback(() => {
    setError(null);
    clearBarangayMapSnapshot(DEFAULT_MAP_AREA.id);
    patchActive((t) => ({
      ...t,
      result: null,
      callListVisible: false,
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
    callListVisible,
    sendMessage,
    clearCallList,
    clearAssist,
    newChat,
    selectChat,
    deleteChat,
    renameChat,
  };
}
