"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ReportStatusBadge, statusLabel } from "@/components/ReportStatusBadge";
import { subscribeAllReports } from "@/lib/reports/api";
import {
  hazardHintLabel,
  type HazardReport,
  type ReportStatus,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | ReportStatus;

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "queued", label: "Queue" },
  { id: "needs_review", label: "Needs review" },
  { id: "assigned", label: "Assigned" },
  { id: "legit", label: "Verified" },
  { id: "dispatched", label: "Dispatched" },
  { id: "done", label: "Done" },
  { id: "rejected", label: "Rejected" },
];

export function DeveloperIncidentsPanel() {
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    return subscribeAllReports((next) => {
      setRows(next);
      setLoading(false);
    });
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      c[r.status] = (c[r.status] ?? 0) + 1;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!needle) return true;
      const hay = [
        r.id,
        r.title,
        r.notes,
        r.barangay,
        r.lgu,
        r.citizenName,
        r.citizenPurok,
        r.investigatorName ?? "",
        hazardHintLabel(r.hazardHint),
        statusLabel(r.status),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, filter, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Incidents
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          All field reports across barangays. Not scoped to one hall.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm ring-1 transition",
              filter === f.id
                ? "bg-[#0f1b2d] text-white ring-[#0f1b2d]"
                : "bg-white text-[var(--foreground)] ring-[var(--border)] hover:ring-[var(--foreground)]/30",
            )}
          >
            {f.label}
            <span className="ml-1.5 tabular-nums text-[11px] opacity-70">
              {f.id === "all" ? counts.all : (counts[f.id] ?? 0)}
            </span>
          </button>
        ))}
      </div>

      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search id, title, barangay, reporter…"
        className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#1d4ed8]"
      />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            Loading incidents…
          </p>
        ) : filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)]">
            No incidents match this filter.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[var(--border)] bg-[#f7f8fa] text-[11px] tracking-wide text-[var(--muted)] uppercase">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Id</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="px-4 py-2.5 font-medium">Barangay</th>
                  <th className="px-4 py-2.5 font-medium">Reporter</th>
                  <th className="px-4 py-2.5 font-medium">When</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-[var(--border)]/70 last:border-0"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dev/incidents/${encodeURIComponent(r.id)}`}
                        className="font-mono text-[11px] font-medium text-[#1d4ed8] hover:underline"
                      >
                        {r.id}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <ReportStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[var(--foreground)]">
                        {r.title || "—"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {hazardHintLabel(r.hazardHint)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {r.barangay
                        ? `${r.barangay}${r.lgu ? ` · ${r.lgu}` : ""}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {r.citizenName || "—"}
                      {r.citizenPurok ? (
                        <span className="block text-[11px]">
                          {r.citizenPurok}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[var(--muted)]">
                      {r.createdAt
                        ? new Date(r.createdAt).toLocaleString("en-PH", {
                            timeZone: "Asia/Manila",
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-[var(--muted)]">
        Showing {filtered.length} of {rows.length} incidents
      </p>
    </div>
  );
}
