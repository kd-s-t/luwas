"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  officerScopeBarangay,
  subscribeBarangayUsers,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isAccountActive,
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import {
  addSupportTicketMessage,
  assignSupportTicket,
  LUWAS_DEVELOPERS_ASSIGNEE,
  subscribeSupportTickets,
  updateSupportTicketStatus,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import { ensureSampleSupportTickets } from "@/lib/support/ensureSampleSupportTickets";

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
  onSend,
}: {
  ticket: SupportTicket;
  busy: boolean;
  onSend: (body: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function submit() {
    const body = draft.trim();
    if (!body || sending || busy) return;
    setSending(true);
    try {
      await onSend(body);
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full min-h-[18rem] flex-col border border-[var(--border)] bg-[var(--surface)]">
      <p className="shrink-0 border-b border-[var(--border)] px-3 py-1.5 font-mono text-[9px] tracking-[0.18em] text-[var(--muted)] uppercase">
        Messages
      </p>
      {ticket.messages.length > 0 ? (
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
          {ticket.messages.map((m) => (
            <li
              key={m.id}
              className="flex items-start justify-end gap-2 text-sm"
            >
              <div className="min-w-0 max-w-[85%] text-right">
                <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  {m.authorName}
                  {m.createdAt
                    ? ` · ${new Date(m.createdAt).toLocaleString()}`
                    : ""}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-[var(--foreground)]">
                  {m.body}
                </p>
              </div>
              <ProfileAvatar
                name={m.authorName}
                seed={m.authorUid || m.authorName}
                size="sm"
                className="mt-0.5"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="min-h-0 flex-1 px-3 py-6 text-right text-xs text-[var(--muted)]">
          No messages yet — leave a triage note below.
        </p>
      )}
      <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] p-3 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || sending}
            rows={2}
            maxLength={2000}
            placeholder="Officer note / reply…"
            className="w-full resize-y border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
          />
        </label>
        <Button
          type="button"
          size="sm"
          className="shrink-0 sm:w-24"
          disabled={busy || sending || !draft.trim()}
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
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        await ensureSampleSupportTickets();
      } catch (err) {
        console.warn("Support sample seed failed", err);
      }
      if (cancelled) return;
      unsub = subscribeSupportTickets((next) => {
        setRows(next);
        setReady(true);
      }, (err) => {
        setError(err.message);
        setReady(true);
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [profile]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile) || !barangay) {
      setOfficers([]);
      return;
    }
    return subscribeBarangayUsers(
      barangay,
      (users) => {
        const active = users.filter(
          (u): u is OfficerProfile => isOfficer(u) && isAccountActive(u),
        );
        active.sort((a, b) =>
          (a.displayName || a.email).localeCompare(b.displayName || b.email),
        );
        setOfficers(active);
      },
      (err) => setError(err.message),
      areaId,
    );
  }, [profile, barangay, areaId]);

  const selected = useMemo(
    () => rows.find((t) => t.id === ticketId) ?? null,
    [rows, ticketId],
  );

  async function setStatus(status: SupportTicketStatus) {
    if (!isOfficer(profile) || !selected) return;
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
    if (!isOfficer(profile) || !selected) return;
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
    if (!isOfficer(profile) || !selected) return;
    await assign(profile.uid, profile.displayName || profile.email);
  }

  async function sendMessage(body: string) {
    if (!isOfficer(profile) || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await addSupportTicketMessage({
        ticketId: selected.id,
        body,
        authorUid: profile.uid,
        authorName: profile.displayName || profile.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Message failed");
      throw err;
    } finally {
      setBusy(false);
    }
  }

  if (!isOfficer(profile) || !isAccountActive(profile)) {
    return (
      <p className="p-6 text-sm text-[var(--muted)]">
        Only active officers can triage support tickets.
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
          href="/overview/support"
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
            href="/overview/support"
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
      </div>

      <div className="grid lg:grid-cols-2">
        <section className="border-b border-[var(--border)] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
          <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
            Ticket
          </p>
          {selected.pageUrl ? (
            <p className="mt-2 break-all font-mono text-[10px] text-[var(--muted)]">
              {selected.pageUrl}
            </p>
          ) : null}
          {selected.details ? (
            <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap">
              {selected.details}
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">No details.</p>
          )}
          <p className="mt-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            {selected.assignedToName
              ? `Assigned · ${selected.assignedToName}`
              : "Unassigned"}
          </p>
          {error ? (
            <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="mt-4 flex max-w-xs flex-col gap-2">
            {(selected.status === "open" ||
              selected.status === "in_progress") && (
              <label className="block">
                <span className="sr-only">Assign officer</span>
                <select
                  value={selected.assignedToUid ?? ""}
                  disabled={busy}
                  aria-label="Assign officer"
                  onChange={(e) => {
                    const uid = e.target.value || null;
                    if (!uid) {
                      void assign(null, null);
                      return;
                    }
                    if (uid === LUWAS_DEVELOPERS_ASSIGNEE.uid) {
                      void assign(
                        LUWAS_DEVELOPERS_ASSIGNEE.uid,
                        LUWAS_DEVELOPERS_ASSIGNEE.name,
                      );
                      return;
                    }
                    const officer = officers.find((o) => o.uid === uid);
                    void assign(
                      uid,
                      officer?.displayName || officer?.email || uid,
                    );
                  }}
                  className="w-full border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 font-mono text-[10px] tracking-wider uppercase outline-none focus:border-[var(--accent)] disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  <option value={LUWAS_DEVELOPERS_ASSIGNEE.uid}>
                    {LUWAS_DEVELOPERS_ASSIGNEE.name}
                  </option>
                  {officers.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.displayName || o.email}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected.status === "open" && !selected.assignedToUid ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void takeIt()}
              >
                Assign me
              </Button>
            ) : null}
            {selected.status === "open" ||
            selected.status === "in_progress" ? (
              <Button
                type="button"
                size="sm"
                disabled={busy}
                onClick={() => void setStatus("resolved")}
              >
                Resolve
              </Button>
            ) : null}
            {selected.status === "resolved" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void setStatus("closed")}
              >
                Close
              </Button>
            ) : null}
            {selected.status === "resolved" ||
            selected.status === "closed" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void setStatus("open")}
              >
                Reopen
              </Button>
            ) : null}
          </div>
        </section>

        <section className="px-4 py-4 sm:px-5">
          <TicketChat
            key={selected.id}
            ticket={selected}
            busy={busy}
            onSend={sendMessage}
          />
        </section>
      </div>
    </div>
  );
}
