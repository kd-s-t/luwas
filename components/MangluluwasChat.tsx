"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  ArrowUp,
  Eraser,
  History,
  MapPinned,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { AssistResult } from "@/lib/ai/assistTypes";
import { enrichActionsWithContacts } from "@/lib/ai/callList";
import type { ChatMessage, SmsLogEntry } from "@/lib/ai/chatTypes";
import { relativeTime } from "@/lib/ai/chatHistory";
import {
  GEMINI_ASSIST_MODELS,
  type GeminiAssistModelId,
} from "@/lib/ai/geminiModels";
import { phoneToTelHref } from "@/lib/geo/responderStations";
import type { Household } from "@/lib/households/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function SmsReplyBody({
  content,
  smsLog,
  onOpenLog,
}: {
  content: string;
  smsLog?: SmsLogEntry[];
  onOpenLog: (log: SmsLogEntry[]) => void;
}) {
  if (!smsLog?.length) {
    return <p className="whitespace-pre-wrap">{content}</p>;
  }
  const match = content.match(/(\d+)\s+message\(s\)/);
  if (!match || match.index === undefined) {
    return (
      <p className="whitespace-pre-wrap">
        {content}{" "}
        <button
          type="button"
          onClick={() => onOpenLog(smsLog)}
          className="font-medium text-[var(--accent)] underline underline-offset-2"
        >
          View sent
        </button>
      </p>
    );
  }
  const start = match.index;
  const end = start + match[0].length;
  return (
    <p className="whitespace-pre-wrap">
      {content.slice(0, start)}
      <button
        type="button"
        onClick={() => onOpenLog(smsLog)}
        className="font-medium text-[var(--accent)] underline underline-offset-2"
      >
        {match[0]}
      </button>
      {content.slice(end)}
    </p>
  );
}

const SUGGESTIONS = [
  "A typhoon cat 5 is coming in 3 days — what do we do?",
  "Run triage",
  "What do the red yellow and blue mean?",
  "Alert them to evacuate",
  "Clear map highlights",
] as const;

function isFreshChat(messages: ChatMessage[]) {
  return messages.length <= 1 && messages.every((m) => m.role === "assistant");
}

export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
  preview: string;
};

type MangluluwasChatProps = {
  messages: ChatMessage[];
  running: boolean;
  result: AssistResult | null;
  /** Show evacuate/prepare list; false after SMS / Clear (map stays). */
  callListVisible?: boolean;
  /** Current roster — used to resolve names/phones on map assist chips. */
  households?: Household[];
  error: string | null;
  model: GeminiAssistModelId;
  onModelChange: (model: GeminiAssistModelId) => void;
  onSend: (text: string) => void;
  /** Clears evacuate list only — not map colors / floods. */
  onClearCallList: () => void;
  chats: ChatSummary[];
  activeChatId: string;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onDeleteChat: (id: string) => void;
  className?: string;
};

export function MangluluwasChat({
  messages,
  running,
  result,
  callListVisible = false,
  households = [],
  error,
  model,
  onModelChange,
  onSend,
  onClearCallList,
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  className,
}: MangluluwasChatProps) {
  const [draft, setDraft] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [smsLogOpen, setSmsLogOpen] = useState<SmsLogEntry[] | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const callActions = useMemo(() => {
    if (!callListVisible || !result?.actions.length) return [];
    return enrichActionsWithContacts(result.actions, households);
  }, [callListVisible, result, households]);

  const evacuateActions = useMemo(
    () => callActions.filter((a) => a.priority === "evacuate"),
    [callActions],
  );

  const alertButtonLabel = useMemo(() => {
    const withPhone = evacuateActions.some((a) => a.phone?.trim());
    const withEmail = evacuateActions.some((a) => a.email?.trim());
    if (withPhone && withEmail) return "Alert evacuate list (SMS + email)";
    if (withEmail) return "Email evacuate list";
    if (withPhone) return "Text evacuate list (SMS)";
    return "Alert evacuate list";
  }, [evacuateActions]);

  useEffect(() => {
    const el = listRef.current;
    if (!el || historyOpen) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, running, historyOpen, activeChatId]);

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || running) return;
    setDraft("");
    setHistoryOpen(false);
    onSend(trimmed);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-0 flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)]",
        className,
      )}
    >
      <header className="shrink-0 space-y-2.5 border-b border-[var(--border)] bg-[var(--surface-panel)] px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2">
          <Image
            src="/mangluluwas.jpg"
            alt="Mangluluwas"
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-full object-cover ring-2 ring-[var(--accent)]/35"
          />
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Mangluluwas
            </p>
            <p className="truncate font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
              {chats.find((c) => c.id === activeChatId)?.title ?? "New chat"}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant={historyOpen ? "default" : "outline"}
              size="icon"
              className="size-8"
              disabled={running}
              onClick={() => setHistoryOpen((o) => !o)}
              aria-label={historyOpen ? "Close history" : "Chat history"}
              aria-pressed={historyOpen}
              title="History"
            >
              {historyOpen ? (
                <X className="size-3.5" aria-hidden />
              ) : (
                <History className="size-3.5" aria-hidden />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={running}
              onClick={() => {
                onNewChat();
                setHistoryOpen(false);
              }}
              aria-label="New chat"
              title="New chat"
            >
              <Plus className="size-3.5" aria-hidden />
            </Button>
            {callListVisible && !historyOpen ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                onClick={onClearCallList}
                aria-label="Clear evacuate list"
                title="Clear evacuate list (map stays)"
              >
                <Eraser className="size-3.5" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
        {!historyOpen ? (
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Model
              <select
                value={model}
                disabled={running}
                onChange={(e) =>
                  onModelChange(e.target.value as GeminiAssistModelId)
                }
                className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)] disabled:opacity-60"
              >
                {GEMINI_ASSIST_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            {result ? (
              <Badge variant="outline">
                via {result.source === "gemini" ? "Gemini" : "local"}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </header>

      {historyOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2 sm:px-4">
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
              History
            </p>
            <button
              type="button"
              disabled={running}
              onClick={() => {
                onNewChat();
                setHistoryOpen(false);
              }}
              className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase transition hover:underline disabled:opacity-50"
            >
              <Plus className="size-3" aria-hidden />
              New chat
            </button>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto py-1">
            {chats.map((chat) => {
              const active = chat.id === activeChatId;
              return (
                <li key={chat.id} className="px-1.5">
                  <div
                    className={cn(
                      "group flex items-start gap-1 border border-transparent px-2 py-2 transition",
                      active
                        ? "border-[var(--accent)]/35 bg-[var(--surface-panel)]"
                        : "hover:bg-[var(--surface-raised)]",
                    )}
                  >
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => {
                        onSelectChat(chat.id);
                        setHistoryOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left disabled:opacity-50"
                    >
                      <p className="truncate text-sm font-medium text-[var(--foreground)]">
                        {chat.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[var(--muted)]">
                        {chat.preview.replace(/\s+/g, " ").trim()}
                      </p>
                      <p className="mt-1 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                        {relativeTime(chat.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      disabled={running}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteChat(chat.id);
                      }}
                      className="mt-0.5 shrink-0 p-1.5 text-[var(--muted)] opacity-70 transition hover:text-[var(--danger)] group-hover:opacity-100 disabled:opacity-40"
                      aria-label={`Delete ${chat.title}`}
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <div
            ref={listRef}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4"
            role="log"
            aria-live="polite"
            aria-label="Mangluluwas chat"
          >
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "flex gap-2",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {m.role === "assistant" ? (
                    <Image
                      src="/mangluluwas.jpg"
                      alt=""
                      width={28}
                      height={28}
                      className="mt-0.5 size-7 shrink-0 rounded-full object-cover"
                    />
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[85%] px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-[var(--accent)] text-[var(--on-accent)]"
                        : "border border-[var(--border)] bg-[var(--surface-raised)] text-[var(--foreground)]",
                    )}
                  >
                    {m.role === "assistant" ? (
                      <SmsReplyBody
                        content={m.content}
                        smsLog={m.smsLog}
                        onOpenLog={setSmsLogOpen}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                    {m.assistApplied ? (
                      <p className="mt-1.5 flex items-center gap-1 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                        <MapPinned className="size-3" aria-hidden />
                        Map updated
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
              {running ? (
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <Image
                    src="/mangluluwas.jpg"
                    alt=""
                    width={28}
                    height={28}
                    className="size-7 rounded-full object-cover opacity-70"
                  />
                  <span className="font-mono text-xs tracking-wider uppercase">
                    Thinking…
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <p
              className="shrink-0 px-4 py-1.5 text-sm text-[var(--danger)]"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {result && callListVisible ? (
            <div className="shrink-0 border-t border-[var(--accent)]/30 bg-[var(--surface-panel)] px-3 py-2 sm:px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
                    Call list · {result.focusHazard}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">
                    {result.mapHint}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClearCallList}
                  className="shrink-0 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase underline-offset-2 hover:text-[var(--accent)] hover:underline"
                >
                  Clear list
                </button>
              </div>
              {callActions.length ? (
                <>
                  <ul className="mt-1.5 flex max-h-48 flex-col gap-1 overflow-y-auto">
                    {callActions.map((a) => {
                      const name = a.ownerName?.trim();
                      const phone = a.phone?.trim();
                      return (
                        <li
                          key={`${a.householdId}-${a.priority}`}
                          className="flex flex-wrap items-center gap-1.5 text-xs"
                        >
                          <Badge
                            variant={
                              a.priority === "evacuate"
                                ? "danger"
                                : a.priority === "prepare"
                                  ? "warn"
                                  : "outline"
                            }
                          >
                            {a.priority}
                          </Badge>
                          <span className="min-w-0 truncate font-medium">
                            {name || "Unknown owner"}
                          </span>
                          {a.purok ? (
                            <span className="font-mono text-[9px] tracking-wide text-[var(--muted)] uppercase">
                              {a.purok}
                            </span>
                          ) : null}
                          {phone ? (
                            <a
                              href={phoneToTelHref(phone)}
                              className="font-mono text-[10px] text-[var(--accent)] underline-offset-2 hover:underline"
                            >
                              {phone}
                            </a>
                          ) : null}
                          {a.email?.trim() ? (
                            <a
                              href={`mailto:${a.email.trim()}`}
                              className="min-w-0 truncate font-mono text-[10px] text-[var(--accent)] underline-offset-2 hover:underline"
                            >
                              {a.email.trim()}
                            </a>
                          ) : null}
                          {!phone && !a.email?.trim() ? (
                            <span className="font-mono text-[10px] text-[var(--muted)]">
                              no phone/email
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                  {evacuateActions.length ? (
                    <button
                      type="button"
                      disabled={running}
                      onClick={() => submit("Alert them to evacuate")}
                      className="mt-2 w-full border border-[var(--danger)] bg-[var(--danger)] px-2 py-2 font-mono text-[10px] font-semibold tracking-wider text-white uppercase shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--border)] disabled:bg-[var(--surface-panel)] disabled:text-[var(--muted)] disabled:opacity-100 disabled:shadow-none"
                    >
                      {running ? "Sending alerts…" : alertButtonLabel}
                    </button>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : result && !callListVisible ? (
            <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-panel)]/60 px-3 py-2 sm:px-4">
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Map still highlighted · list cleared after text
              </p>
            </div>
          ) : null}

          <div className="shrink-0 border-t border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 sm:px-4">
            {isFreshChat(messages) && !running ? (
              <div
                className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:thin]"
                aria-label="Suggested prompts"
              >
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    disabled={running}
                    onClick={() => submit(s)}
                    className="shrink-0 border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[9px] tracking-wider whitespace-nowrap text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
            <form onSubmit={onSubmit} className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask Mangluluwas…"
                disabled={running}
                className="min-h-10 max-h-28 flex-1 resize-none border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-60"
                aria-label="Message Mangluluwas"
              />
              <Button
                type="submit"
                size="icon"
                disabled={running || !draft.trim()}
                aria-label="Send"
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
            </form>
          </div>
        </>
      )}

      <Dialog
        open={Boolean(smsLogOpen?.length)}
        onOpenChange={(open) => {
          if (!open) setSmsLogOpen(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sent messages</DialogTitle>
            <DialogDescription>
              {smsLogOpen?.length ?? 0} alert
              {(smsLogOpen?.length ?? 0) === 1 ? "" : "s"}{" "}
              ({smsLogOpen?.filter((r) => r.channel === "email").length ?? 0}{" "}
              email ·{" "}
              {smsLogOpen?.filter((r) => r.channel !== "email").length ?? 0} SMS)
              {(smsLogOpen?.filter((r) => r.ok).length ?? 0) ===
              (smsLogOpen?.length ?? 0)
                ? " logged"
                : " attempted"}{" "}
              for this blast.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[min(60vh,28rem)] space-y-3">
            {(smsLogOpen ?? []).map((entry, i) => (
              <article
                key={`${entry.channel ?? "sms"}-${entry.to}-${i}`}
                className="border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">
                    {entry.channel === "email" ? "email" : "sms"}
                  </Badge>
                  {entry.priority ? (
                    <Badge
                      variant={
                        entry.priority === "evacuate"
                          ? "danger"
                          : entry.priority === "prepare"
                            ? "warn"
                            : "outline"
                      }
                    >
                      {entry.priority}
                    </Badge>
                  ) : null}
                  <span className="min-w-0 truncate text-sm font-medium">
                    {entry.ownerName?.trim() || "Resident"}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--accent)]">
                    {entry.channel === "email"
                      ? (entry.emailDisplay ?? entry.to)
                      : (entry.phoneDisplay ?? entry.to)}
                  </span>
                  {!entry.ok ? (
                    <span className="font-mono text-[10px] text-[var(--danger)] uppercase">
                      failed
                    </span>
                  ) : null}
                </div>
                {entry.subject ? (
                  <p className="mt-1.5 text-xs font-medium text-[var(--foreground)]">
                    {entry.subject}
                  </p>
                ) : null}
                {entry.body ? (
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--foreground)]">
                    {entry.body}
                  </p>
                ) : entry.error ? (
                  <p className="mt-2 text-xs text-[var(--danger)]">
                    {entry.error}
                  </p>
                ) : null}
              </article>
            ))}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}
