"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { Button } from "@/components/ui/button";
import { scopeLabel } from "@/lib/reports/barangayScope";
import {
  buildIncidentBoardRows,
  rowMatchesSearch,
  type BoardUrgency,
  type IncidentBoardRow,
} from "@/lib/workspace/incidentBoardRows";
import { useScenario } from "@/lib/scenarios";
import { cn } from "@/lib/utils";

type UrgencyFilter = "all" | BoardUrgency;
type StatusFilter = "all" | "needs_action" | "dispatched" | "pending" | "intake";

function urgencyToneClass(tone: IncidentBoardRow["badgeTone"]): string {
  if (tone === "critical") {
    return "border-[var(--danger)]/35 bg-[var(--danger)]/10 text-[var(--danger)]";
  }
  if (tone === "high") {
    return "border-[#c45c12]/30 bg-[#c45c12]/10 text-[#9a4508]";
  }
  if (tone === "intake") {
    return "border-[#c45c12]/25 bg-[#f3e6d8] text-[#8a4b1a]";
  }
  return "border-[var(--success)]/35 bg-[var(--success)]/10 text-[var(--success)]";
}

function statusFilterMatch(row: IncidentBoardRow, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "intake") return row.section === "intake";
  if (filter === "needs_action") {
    return (
      row.ctaPrimary ||
      row.statusLine.toLowerCase().includes("needs action") ||
      row.statusLine.toLowerCase().includes("unverified")
    );
  }
  if (filter === "dispatched") {
    return row.statusLine.toLowerCase().includes("dispatched");
  }
  if (filter === "pending") {
    return row.statusLine.toLowerCase().includes("pending");
  }
  return true;
}

function BoardRow({ row }: { row: IncidentBoardRow }) {
  const href = `/admin/incidents/${encodeURIComponent(row.report.id)}`;
  const badge =
    row.badgeLabel ??
    (row.section === "operational" ? row.urgencyLabel : null);

  return (
    <li className="border-b border-[var(--border)] last:border-b-0">
      <div className="grid gap-3 px-1 py-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:px-0">
        <div className="min-w-0">
          {badge ? (
            <span
              className={cn(
                "inline-flex border px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase",
                urgencyToneClass(row.badgeTone),
              )}
            >
              {badge}
            </span>
          ) : null}
          <Link
            href={href}
            className="mt-1.5 block font-[family-name:var(--font-display)] text-base font-semibold tracking-wide text-[var(--foreground)] hover:text-[var(--accent)]"
          >
            {row.placeLine}
          </Link>
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-[var(--muted)] tabular-nums">
            {row.code}
            {row.section === "operational" && row.relatedCount > 1
              ? ` · ${row.relatedCount} linked citizen reports`
              : null}
          </p>
          {row.section === "operational" && row.relatedCount > 1 ? (
            <Link
              href={href}
              className="mt-1 inline-block text-xs text-[var(--accent)] hover:underline"
            >
              Related reports · {row.code} ({row.relatedCount}) →
            </Link>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--foreground)]">
            {row.statusLine}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{row.responderLine}</p>
        </div>

        <div className="sm:justify-self-end">
          <Button
            asChild
            size="sm"
            variant={row.ctaPrimary ? "default" : "outline"}
            className="min-w-[9.5rem]"
          >
            <Link href={href}>{row.ctaLabel}</Link>
          </Button>
        </div>
      </div>
    </li>
  );
}

function Section({
  title,
  rows,
}: {
  title: string;
  rows: IncidentBoardRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="border-b border-[var(--border)] pb-2 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
        {title}
      </h2>
      <ul>{rows.map((row) => <BoardRow key={row.report.id} row={row} />)}</ul>
    </section>
  );
}

export function IncidentBoard() {
  const { officerBundle, tinoActive } = useScenario();
  const { scopedReports, reportScope } = useCommandWorkspace();
  const [query, setQuery] = useState("");
  const [urgency, setUrgency] = useState<UrgencyFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const built = useMemo(
    () => buildIncidentBoardRows(scopedReports),
    [scopedReports],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pass = (row: IncidentBoardRow) => {
      if (!rowMatchesSearch(row, q)) return false;
      if (urgency !== "all" && row.urgency !== urgency) return false;
      if (!statusFilterMatch(row, status)) return false;
      return true;
    };
    return {
      operational: built.operational.filter(pass),
      intake: built.intake.filter(pass),
    };
  }, [built, query, urgency, status]);

  const dateLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Manila",
      }).format(new Date());
    } catch {
      return "";
    }
  }, []);

  const empty =
    filtered.operational.length === 0 && filtered.intake.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--surface)]">
      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
              Incidents
            </h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {dateLabel}
              {dateLabel ? " · " : ""}
              Philippine Standard Time (PHT)
              {tinoActive
                ? ` · ${officerBundle.shortLabel} · ${scopeLabel(reportScope)}`
                : ` · ${scopeLabel(reportScope)}`}
            </p>
          </div>
        </header>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by barangay or incident number"
            aria-label="Search incidents"
            className="h-10 min-w-0 flex-1 border border-[var(--border)] bg-[var(--input)] px-3 text-sm outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          />
          <label className="flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--muted)]">
            <span className="shrink-0">Urgency</span>
            <select
              value={urgency}
              onChange={(e) => setUrgency(e.target.value as UrgencyFilter)}
              className="bg-transparent text-[var(--foreground)] outline-none"
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="moderate">Moderate</option>
            </select>
          </label>
          <label className="flex h-10 items-center gap-2 border border-[var(--border)] bg-[var(--input)] px-3 text-sm text-[var(--muted)]">
            <span className="shrink-0">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              className="bg-transparent text-[var(--foreground)] outline-none"
            >
              <option value="all">All</option>
              <option value="needs_action">Needs action</option>
              <option value="dispatched">Dispatched</option>
              <option value="pending">Approval pending</option>
              <option value="intake">Citizen intake</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-sm text-[var(--muted)]">
          {built.activeCount} active incident{built.activeCount === 1 ? "" : "s"}
          {" · "}
          {built.completedCount} completed
          {" · "}
          {built.intakeCount} unlinked citizen report
          {built.intakeCount === 1 ? "" : "s"}
        </p>

        <div className="mt-5 hidden border-b border-[var(--border)] pb-2 font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase sm:grid sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] sm:gap-4">
          <span>Incident & location</span>
          <span>Status & responder</span>
          <span className="justify-self-end">Next action</span>
        </div>

        {empty ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
              {scopedReports.length === 0
                ? "No field reports in scope yet"
                : "No incidents match these filters"}
            </p>
            <p className="max-w-md text-sm text-[var(--muted)]">
              {scopedReports.length === 0
                ? `When citizens post reports for ${scopeLabel(reportScope)}, they appear here.`
                : "Clear search or filters to see the full board."}
            </p>
          </div>
        ) : (
          <>
            <Section title="Operational incidents" rows={filtered.operational} />
            <Section title="Citizen intake" rows={filtered.intake} />
          </>
        )}
      </div>
    </div>
  );
}
