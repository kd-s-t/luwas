"use client";

import { useEffect, useMemo, useState } from "react";
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
  assignSupportTicket,
  subscribeSupportTickets,
  updateSupportTicketStatus,
  type SupportTicket,
  type SupportTicketStatus,
} from "@/lib/support/api";
import { cn } from "@/lib/utils";

type Filter = "open" | "all" | "done";

function statusVariant(
  status: SupportTicketStatus,
): "default" | "outline" | "warn" | "danger" {
  if (status === "open") return "danger";
  if (status === "in_progress") return "warn";
  return "outline";
}

function statusLabel(status: SupportTicketStatus): string {
  if (status === "in_progress") return "In progress";
  return status;
}

export function SupportTicketsPanel() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SupportTicket[]>([]);
  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [filter, setFilter] = useState<Filter>("open");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    return subscribeSupportTickets(setRows, (err) => setError(err.message));
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
          (u): u is OfficerProfile =>
            isOfficer(u) && isAccountActive(u),
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

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "done") {
      return rows.filter(
        (r) => r.status === "resolved" || r.status === "closed",
      );
    }
    return rows.filter(
      (r) => r.status === "open" || r.status === "in_progress",
    );
  }, [rows, filter]);

  const openCount = rows.filter(
    (r) => r.status === "open" || r.status === "in_progress",
  ).length;

  async function setStatus(ticket: SupportTicket, status: SupportTicketStatus) {
    if (!isOfficer(profile)) return;
    setBusyId(ticket.id);
    setError(null);
    try {
      await updateSupportTicketStatus({
        ticketId: ticket.id,
        status,
        officerUid: profile.uid,
        officerName: profile.displayName || profile.email,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function assign(
    ticket: SupportTicket,
    assigneeUid: string | null,
    assigneeName: string | null,
  ) {
    if (!isOfficer(profile)) return;
    setBusyId(ticket.id);
    setError(null);
    try {
      await assignSupportTicket({
        ticketId: ticket.id,
        assigneeUid,
        assigneeName,
        promoteToInProgress:
          Boolean(assigneeUid) && ticket.status === "open",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  async function takeIt(ticket: SupportTicket) {
    if (!isOfficer(profile)) return;
    setBusyId(ticket.id);
    setError(null);
    try {
      await assignSupportTicket({
        ticketId: ticket.id,
        assigneeUid: profile.uid,
        assigneeName: profile.displayName || profile.email,
        promoteToInProgress: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!isOfficer(profile) || !isAccountActive(profile)) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Only active officers can triage support tickets.
      </p>
    );
  }

  return (
    <section className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4">
        <div className="min-w-0">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Product support
          </p>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide sm:text-xl">
            Support tickets
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            <span className="text-[var(--foreground)]">
              {openCount} open
            </span>{" "}
            · bug reports from /support · assign an officer to own the fix
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["open", "Open"],
              ["done", "Resolved"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={cn(
                "border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase",
                filter === id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                  : "border-[var(--border)] text-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="px-4 py-2 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {filtered.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No tickets in this view.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {filtered.map((t) => (
            <li
              key={t.id}
              className="flex flex-col gap-3 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium sm:text-base">{t.summary}</p>
                  <Badge variant={statusVariant(t.status)}>
                    {statusLabel(t.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t.email || "No email"} ·{" "}
                  {t.createdAt
                    ? new Date(t.createdAt).toLocaleString()
                    : "—"}
                </p>
                {t.pageUrl ? (
                  <p className="mt-0.5 break-all font-mono text-[10px] text-[var(--muted)]">
                    {t.pageUrl}
                  </p>
                ) : null}
                {t.details ? (
                  <p className="mt-2 text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap">
                    {t.details}
                  </p>
                ) : null}
                <p className="mt-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  {t.assignedToName
                    ? `Assigned · ${t.assignedToName}`
                    : "Unassigned"}
                </p>
                {t.resolvedByName &&
                (t.status === "resolved" || t.status === "closed") ? (
                  <p className="mt-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Closed by {t.resolvedByName}
                    {t.resolvedAt
                      ? ` · ${new Date(t.resolvedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-48 sm:shrink-0">
                {(t.status === "open" || t.status === "in_progress") && (
                  <label className="block">
                    <span className="sr-only">Assign officer</span>
                    <select
                      value={t.assignedToUid ?? ""}
                      disabled={busyId === t.id}
                      aria-label="Assign officer"
                      onChange={(e) => {
                        const uid = e.target.value || null;
                        if (!uid) {
                          void assign(t, null, null);
                          return;
                        }
                        const officer = officers.find((o) => o.uid === uid);
                        void assign(
                          t,
                          uid,
                          officer?.displayName || officer?.email || uid,
                        );
                      }}
                      className="w-full border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 font-mono text-[10px] tracking-wider uppercase outline-none focus:border-[var(--accent)] disabled:opacity-50"
                    >
                      <option value="">Unassigned</option>
                      {officers.map((o) => (
                        <option key={o.uid} value={o.uid}>
                          {o.displayName || o.email}
                        </option>
                      ))}
                      {t.assignedToUid &&
                      !officers.some((o) => o.uid === t.assignedToUid) ? (
                        <option value={t.assignedToUid}>
                          {t.assignedToName || t.assignedToUid}
                        </option>
                      ) : null}
                    </select>
                  </label>
                )}
                {t.status === "open" && !t.assignedToUid ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busyId === t.id}
                    onClick={() => void takeIt(t)}
                  >
                    Assign me
                  </Button>
                ) : null}
                {t.status === "open" || t.status === "in_progress" ? (
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    disabled={busyId === t.id}
                    onClick={() => void setStatus(t, "resolved")}
                  >
                    Resolve
                  </Button>
                ) : null}
                {t.status === "resolved" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busyId === t.id}
                    onClick={() => void setStatus(t, "closed")}
                  >
                    Close
                  </Button>
                ) : null}
                {t.status === "resolved" || t.status === "closed" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={busyId === t.id}
                    onClick={() => void setStatus(t, "open")}
                  >
                    Reopen
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
