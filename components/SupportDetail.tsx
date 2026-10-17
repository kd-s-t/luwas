"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isDeveloper,
  type OfficerProfile,
} from "@/lib/auth/types";
import {
  addSupportTicketMessage,
  assignSupportTicket,
  UGNAI_DEVELOPERS_ASSIGNEE,
  subscribeSupportTickets,
  updateSupportTicketStatus,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import {
  isSupportMediaFile,
  isSupportVideoUrl,
  supportMediaLimit,
  uploadSupportMedia,
} from "@/lib/support/upload";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

function SupportMedia({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-2">
      {urls.map((src) => (
        <li key={src}>
          {isSupportVideoUrl(src) ? (
            <video
              src={src}
              controls
              playsInline
              className="max-h-64 max-w-full border border-[var(--border)]"
            />
          ) : (
            <a href={src} target="_blank" rel="noreferrer" className="block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className="max-h-48 max-w-full border border-[var(--border)] object-contain"
              />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function statusVariant(
  status: SupportTicketStatus,
): "default" | "outline" | "warn" | "danger" | "success" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "warn";
  if (status === "resolved") return "success";
  return "outline";
}

function statusLabel(status: SupportTicketStatus): string {
  if (status === "in_progress") return "In progress";
  return status;
}

function TicketChat({
  ticket,
  busy,
  authorUid,
  onSend,
}: {
  ticket: SupportTicket;
  busy: boolean;
  authorUid: string;
  onSend: (body: string, mediaUrls: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [files]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!isSupportMediaFile(file)) continue;
      if (next.length >= supportMediaLimit()) break;
      next.push(file);
    }
    setFiles(next);
  }

  async function submit() {
    const body = draft.trim();
    if ((!body && files.length === 0) || busy || sending) return;
    setSending(true);
    try {
      const mediaUrls: string[] = [];
      for (const file of files) {
        const up = await uploadSupportMedia({ uid: authorUid, file });
        mediaUrls.push(up.mediaUrl);
      }
      await onSend(body, mediaUrls);
      setDraft("");
      setFiles([]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="space-y-2">
        {ticket.messages.length === 0 ? (
          <li className="text-sm text-[var(--muted)]">No messages yet.</li>
        ) : (
          ticket.messages.map((m, i) => (
            <li
              key={`${m.id}-${i}`}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2"
            >
              <p className="text-[11px] text-[var(--muted)]">
                {m.authorName}
                {m.createdAt
                  ? ` · ${new Date(m.createdAt).toLocaleString()}`
                  : ""}
              </p>
              {m.body ? (
                <p className="mt-1 text-sm whitespace-pre-wrap">{m.body}</p>
              ) : null}
              <SupportMedia urls={m.mediaUrls} />
            </li>
          ))
        )}
      </ul>
      {previews.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {previews.map((src, i) => {
            const file = files[i];
            const video =
              file?.type.startsWith("video/") ||
              (file ? isSupportVideoUrl(file.name) : false);
            return (
              <li key={`${src}-${i}`} className="relative">
                {video ? (
                  <video
                    src={src}
                    className="h-16 w-24 border border-[var(--border)] object-cover"
                    muted
                    playsInline
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={src}
                    alt=""
                    className="h-16 w-16 border border-[var(--border)] object-cover"
                  />
                )}
                <button
                  type="button"
                  disabled={busy || sending}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, idx) => idx !== i))
                  }
                  className="absolute top-0.5 right-0.5 bg-black/70 px-1 text-[10px] text-white"
                >
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Reply…"
            className="min-h-[4.5rem] w-full resize-y rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            disabled={busy || sending}
          />
          {files.length < supportMediaLimit() ? (
            <label className="inline-flex w-fit cursor-pointer border border-dashed border-[var(--border)] bg-white px-2.5 py-1.5 text-xs text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]">
              <input
                type="file"
                accept="image/*,video/*"
                multiple
                disabled={busy || sending}
                className="sr-only"
                onChange={(e) => {
                  onPickFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              Add photo or video
            </label>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          className="shrink-0 sm:w-24"
          disabled={busy || sending || (!draft.trim() && files.length === 0)}
          onClick={() => void submit()}
        >
          {sending ? "…" : "Send"}
        </Button>
      </div>
    </div>
  );
}

export function SupportDetail({ ticketId }: { ticketId: string }) {
  const { profile } = useAuth();
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setTickets([]);
      setReady(true);
      return;
    }
    return subscribeSupportTickets((rows) => {
      setTickets(rows);
      setReady(true);
    });
  }, [profile]);

  useEffect(() => {
    if (!isDeveloper(profile) || !isAccountActive(profile)) {
      setOfficers([]);
      return;
    }
    return onSnapshot(collection(getClientDb(), "users"), (snap) => {
      const next: OfficerProfile[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        if (data.role !== "officer") continue;
        const status = data.accountStatus as string | undefined;
        if (status === "fired" || status === "rejected" || status === "pending") {
          continue;
        }
        next.push({
          uid: String(data.uid ?? d.id),
          email: String(data.email ?? ""),
          displayName: String(data.displayName ?? ""),
          orgName: String(data.orgName ?? ""),
          role: "officer",
          createdAt: String(data.createdAt ?? ""),
          accountStatus: "active",
        });
      }
      next.sort((a, b) =>
        (a.displayName || a.email).localeCompare(b.displayName || b.email),
      );
      setOfficers(next);
    });
  }, [profile]);

  const selected = useMemo(
    () => tickets.find((t) => t.id === ticketId) ?? null,
    [tickets, ticketId],
  );

  async function setStatus(status: SupportTicketStatus) {
    if (!isDeveloper(profile) || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await updateSupportTicketStatus({
        ticketId: selected.id,
        status,
        officerUid: profile.uid,
        officerName: profile.displayName || profile.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(
    assigneeUid: string | null,
    assigneeName: string | null,
  ) {
    if (!isDeveloper(profile) || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await assignSupportTicket({
        ticketId: selected.id,
        assigneeUid,
        assigneeName,
        promoteToInProgress:
          Boolean(assigneeUid) && selected.status === "open",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function takeIt() {
    if (!isDeveloper(profile) || !selected) return;
    await assign(profile.uid, profile.displayName || profile.email);
  }

  async function sendMessage(body: string, mediaUrls: string[]) {
    if (!isDeveloper(profile) || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await addSupportTicketMessage({
        ticketId: selected.id,
        body,
        authorUid: profile.uid,
        authorName: profile.displayName || profile.email,
        mediaUrls,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (!isDeveloper(profile) || !isAccountActive(profile)) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        Only developers can triage support tickets.
      </p>
    );
  }

  if (!ready) {
    return <CommandContentSkeleton fill />;
  }

  if (!selected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Ticket not found
        </p>
        <Link
          href="/dev/support"
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          ← Back to board
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mb-2">
          <Link
            href="/dev/support"
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Support board
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-base font-semibold sm:text-lg">
            {selected.summary}
          </h1>
          <Badge variant={statusVariant(selected.status)}>
            {statusLabel(selected.status)}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {selected.email || "No email"}
          {selected.createdAt
            ? ` · ${new Date(selected.createdAt).toLocaleString()}`
            : ""}
        </p>
        {error ? (
          <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 px-4 py-5 sm:px-5 lg:grid-cols-[1fr_16rem]">
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-sm font-semibold">Details</h2>
            <p className="text-sm whitespace-pre-wrap text-[var(--muted)]">
              {selected.details || "—"}
            </p>
            <SupportMedia urls={selected.mediaUrls} />
          </section>
          <section>
            <h2 className="mb-2 text-sm font-semibold">Thread</h2>
            <TicketChat
              ticket={selected}
              busy={busy}
              authorUid={profile.uid}
              onSend={sendMessage}
            />
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-[var(--border)] bg-white p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
              Status
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {(
                ["open", "in_progress", "resolved", "closed"] as const
              ).map((s) => (
                <Button
                  key={s}
                  type="button"
                  size="sm"
                  variant={selected.status === s ? "default" : "outline"}
                  disabled={busy || selected.status === s}
                  onClick={() => void setStatus(s)}
                >
                  {statusLabel(s)}
                </Button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-white p-3">
            <h2 className="mb-2 text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
              Assignee
            </h2>
            <p className="mb-2 text-sm">
              {selected.assignedToName || "Unassigned"}
            </p>
            <div className="flex flex-col gap-1.5">
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void takeIt()}
              >
                Take it
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  void assign(
                    UGNAI_DEVELOPERS_ASSIGNEE.uid,
                    UGNAI_DEVELOPERS_ASSIGNEE.name,
                  )
                }
              >
                <span className="inline-flex items-center gap-2">
                  <ProfileAvatar
                    name={UGNAI_DEVELOPERS_ASSIGNEE.name}
                    seed={UGNAI_DEVELOPERS_ASSIGNEE.uid}
                    size="sm"
                  />
                  {UGNAI_DEVELOPERS_ASSIGNEE.name}
                </span>
              </Button>
              {officers.slice(0, 8).map((o) => (
                <Button
                  key={o.uid}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void assign(o.uid, o.displayName || o.email)
                  }
                >
                  {o.displayName || o.email}
                </Button>
              ))}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !selected.assignedToUid}
                onClick={() => void assign(null, null)}
              >
                Clear assignee
              </Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
