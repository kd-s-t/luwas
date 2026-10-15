"use client";

import { useMemo, useState } from "react";
import { Scale } from "lucide-react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { HazardReport, ReportStatus } from "@/lib/reports/types";
import {
  LUWAS_DEVELOPERS_ASSIGNEE,
  type SupportTicket,
} from "@/lib/support/api";
import { scopeLabel } from "@/lib/reports/barangayScope";
import { cn } from "@/lib/utils";

const ACTIVE_SUPPORT = new Set(["open", "in_progress"]);
const ACTIVE_INCIDENT = new Set<ReportStatus>([
  "queued",
  "validating",
  "needs_review",
  "failed",
  "legit",
]);

type LoadRow = {
  key: string;
  name: string;
  photoURL: string | null;
  seed: string;
  title: string | null;
  support: number;
  incidents: number;
  unassigned?: boolean;
};

function activeSupport(t: SupportTicket): boolean {
  return ACTIVE_SUPPORT.has(t.status);
}

function activeIncident(r: HazardReport): boolean {
  return ACTIVE_INCIDENT.has(r.status);
}

export function OfficerWorkloadInfo({
  className,
  supportTickets: tickets = [],
}: {
  className?: string;
  /** Support ticket load (developer Support board passes these). */
  supportTickets?: SupportTicket[];
}) {
  const { activeOfficers, scopedReports, reportScope } =
    useCommandWorkspace();
  const [open, setOpen] = useState(false);

  const place = scopeLabel(reportScope);
  const officers = activeOfficers;

  const rows = useMemo(() => {
    const byUid = new Map<string, LoadRow>();

    for (const o of officers) {
      byUid.set(o.uid, {
        key: o.uid,
        name: o.displayName || o.email,
        photoURL: o.photoURL ?? null,
        seed: o.displayName || o.email,
        title: o.officerTitle || o.orgName || null,
        support: 0,
        incidents: 0,
      });
    }

    byUid.set(LUWAS_DEVELOPERS_ASSIGNEE.uid, {
      key: LUWAS_DEVELOPERS_ASSIGNEE.uid,
      name: LUWAS_DEVELOPERS_ASSIGNEE.name,
      photoURL: null,
      seed: LUWAS_DEVELOPERS_ASSIGNEE.uid,
      title: "Product team",
      support: 0,
      incidents: 0,
    });

    let unassignedSupport = 0;
    let unassignedIncidents = 0;

    for (const t of tickets) {
      if (!activeSupport(t)) continue;
      const uid = t.assignedToUid;
      if (!uid) {
        unassignedSupport += 1;
        continue;
      }
      const row = byUid.get(uid);
      if (row) {
        row.support += 1;
      } else {
        byUid.set(uid, {
          key: uid,
          name: t.assignedToName || "Officer",
          photoURL: null,
          seed: uid,
          title: null,
          support: 1,
          incidents: 0,
        });
      }
    }

    for (const r of scopedReports) {
      if (!activeIncident(r)) continue;
      const uid = r.investigatorUid;
      if (!uid) {
        unassignedIncidents += 1;
        continue;
      }
      const row = byUid.get(uid);
      if (row) {
        row.incidents += 1;
      } else {
        byUid.set(uid, {
          key: uid,
          name: r.investigatorName || "Officer",
          photoURL: null,
          seed: uid,
          title: null,
          support: 0,
          incidents: 1,
        });
      }
    }

    const officerRows = [...byUid.values()].sort((a, b) => {
      const ta = a.support + a.incidents;
      const tb = b.support + b.incidents;
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name);
    });

    const out: LoadRow[] = [...officerRows];
    if (unassignedSupport > 0 || unassignedIncidents > 0) {
      out.push({
        key: "__unassigned__",
        name: "Unassigned",
        photoURL: null,
        seed: "unassigned",
        title: "Needs an owner",
        support: unassignedSupport,
        incidents: unassignedIncidents,
        unassigned: true,
      });
    }
    return out;
  }, [officers, tickets, scopedReports]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        support: acc.support + r.support,
        incidents: acc.incidents + r.incidents,
      }),
      { support: 0, incidents: 0 },
    );
  }, [rows]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            className,
          )}
          aria-label="Officer work balance"
          title="Work balance"
        >
          <Scale className="size-3.5" strokeWidth={2.25} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Work balance</DialogTitle>
          <DialogDescription>
            Active support tickets and incidents per officer
            {place ? ` · ${place}` : ""}. Use this to keep load even.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <div className="flex flex-wrap gap-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            <span>
              Support{" "}
              <span className="tabular-nums text-[var(--foreground)]">
                {totals.support}
              </span>
            </span>
            <span>
              Incidents{" "}
              <span className="tabular-nums text-[var(--foreground)]">
                {totals.incidents}
              </span>
            </span>
            <span>
              Total{" "}
              <span className="tabular-nums text-[var(--foreground)]">
                {totals.support + totals.incidents}
              </span>
            </span>
          </div>

          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              No active officers or open work in scope yet.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)] border border-[var(--border)]">
              <li className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.25rem] gap-2 bg-[var(--surface-panel)] px-3 py-2 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                <span>Officer</span>
                <span className="text-right">Support</span>
                <span className="text-right">Incidents</span>
                <span className="text-right">Total</span>
              </li>
              {rows.map((r) => {
                const total = r.support + r.incidents;
                return (
                  <li
                    key={r.key}
                    className={cn(
                      "grid grid-cols-[minmax(0,1fr)_3.25rem_3.25rem_3.25rem] items-center gap-2 px-3 py-2.5",
                      r.unassigned && "bg-[var(--surface-panel)]/50",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      {r.unassigned ? (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border)] text-[10px] text-[var(--muted)]">
                          ?
                        </span>
                      ) : (
                        <ProfileAvatar
                          name={r.name}
                          photoURL={r.photoURL}
                          seed={r.seed}
                          size="sm"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--foreground)]">
                          {r.name}
                        </p>
                        {r.title ? (
                          <p className="truncate text-[11px] text-[var(--muted)]">
                            {r.title}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-right font-mono text-sm tabular-nums text-[var(--foreground)]">
                      {r.support}
                    </span>
                    <span className="text-right font-mono text-sm tabular-nums text-[var(--foreground)]">
                      {r.incidents}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-sm font-medium tabular-nums",
                        total > 0
                          ? "text-[var(--accent)]"
                          : "text-[var(--muted)]",
                      )}
                    >
                      {total}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-[11px] text-[var(--muted)]">
            Counts open / in-progress support and active incidents (review +
            verified) assigned to each officer.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
