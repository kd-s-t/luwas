"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listenAllSuggestions } from "@/lib/resourcesSuggestions/api";
import type { ResourceSuggestion } from "@/lib/resourcesSuggestions/types";

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

export function ResourceSuggestionsBoard() {
  const [rows, setRows] = useState<ResourceSuggestion[]>([]);

  useEffect(() => listenAllSuggestions(setRows), []);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
            <Link
              href="/admin/resources"
              className="text-[#2f5f9e] hover:underline"
            >
              Resources
            </Link>
            <span className="mx-1.5 text-[var(--border)]">/</span>
            Suggested
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
            Resources suggested
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            One saved plan per shortage. Sitio requests are nested in that plan.
          </p>
        </div>
        <p className="text-[12px] text-[var(--muted)]">
          {rows.length} {rows.length === 1 ? "plan" : "plans"}
        </p>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[12px] text-[var(--muted)]">
                <th className="px-4 py-2.5 font-medium sm:px-5">Plan</th>
                <th className="px-3 py-2.5 font-medium">Resource</th>
                <th className="px-3 py-2.5 font-medium">Requests</th>
                <th className="px-3 py-2.5 font-medium">Need</th>
                <th className="px-3 py-2.5 font-medium">Gap</th>
                <th className="px-4 py-2.5 font-medium sm:px-5" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5"
                  >
                    No suggestions yet. Open a shortage with Review shortage to
                    save a plan.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[var(--border)] last:border-b-0"
                  >
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/admin/resources/${encodeURIComponent(row.id)}`}
                        className="font-medium text-[#2f5f9e] hover:underline"
                      >
                        {row.id}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-[var(--foreground)]">
                      {row.resourceLabel}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {row.requestCount || row.requests.length} sitios
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {fmtL(row.totalNeededL)}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-semibold text-[#c72929]">
                      {fmtL(row.shortageL)}
                    </td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Link
                        href={`/admin/resources/${encodeURIComponent(row.id)}`}
                        className="inline-flex rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                      >
                        Open plan
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
