"use client";

import Image from "next/image";
import Link from "next/link";
import { ShortagePlanMap } from "@/components/ShortagePlanMap";
import type { SupplyShortagePlan } from "@/lib/workspace/supplyShortagePlan";
import { cn } from "@/lib/utils";

function fmtL(n: number): string {
  return `${n.toLocaleString("en-PH")} L`;
}

function readinessTone(readiness: SupplyShortagePlan["rows"][number]["readiness"]) {
  if (readiness === "ready") {
    return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
  if (readiness === "no_transport") {
    return "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]";
  }
  return "bg-[#fffbeb] text-[#b45309] ring-[#fde68a]";
}

export function ResourceShortagePlan({
  plan,
  placeLine,
  updatedLabel,
}: {
  plan: SupplyShortagePlan;
  placeLine: string;
  updatedLabel: string;
}) {
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
            <span className="font-mono">{plan.code}</span>
          </p>
          <h1 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
            Resources
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
            Coordinate limited supplies and create an allocation plan.{" "}
            <span className="font-mono text-[var(--foreground)]">{plan.code}</span>
          </p>
        </div>
        <div className="text-right text-[12px] text-[var(--muted)]">
          <p>{placeLine}</p>
          <p className="mt-0.5">Last updated {updatedLabel}</p>
        </div>
      </div>

      <label className="mt-5 block max-w-md">
        <span className="text-[11px] font-medium tracking-wide text-[var(--muted)]">
          Select resource
        </span>
        <div className="mt-1.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2.5 shadow-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {plan.resourceLabel}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {plan.resourceBlurb}
          </p>
        </div>
      </label>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Total needed</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#2f5f9e]">
            {fmtL(plan.totalNeededL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            From {plan.communityCount}{" "}
            {plan.communityCount === 1 ? "community" : "communities"}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Available supply</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#16794c]">
            {fmtL(plan.availableL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            In LGU warehouse
          </p>
        </div>
        <div className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] px-4 py-4 shadow-sm">
          <p className="text-[12px] text-[var(--muted)]">Shortage</p>
          <p className="mt-1 font-[family-name:var(--font-display)] text-3xl font-semibold tabular-nums tracking-wide text-[#c72929]">
            {fmtL(plan.shortageL)}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Warehouse-only gap
          </p>
        </div>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
            Communities needing {plan.resourceLabel.toLowerCase()}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {plan.code} · {plan.communityCount} open requests
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[#f8fafc] text-[11px] font-medium tracking-wide text-[var(--muted)]">
                <th className="px-4 py-2.5 font-medium sm:px-5">Community</th>
                <th className="px-3 py-2.5 font-medium">People affected</th>
                <th className="px-3 py-2.5 font-medium">Need (L)</th>
                <th className="px-3 py-2.5 font-medium">
                  Current local stock (L)
                </th>
                <th className="px-3 py-2.5 font-medium">Gap (L)</th>
                <th className="px-3 py-2.5 font-medium">Delivery readiness</th>
                <th className="px-4 py-2.5 font-medium sm:px-5">Action</th>
              </tr>
            </thead>
            <tbody>
              {plan.rows.map((row) => (
                <tr
                  key={row.reportId}
                  className="border-b border-[var(--border)] last:border-b-0"
                >
                  <td className="px-4 py-3 sm:px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-9 shrink-0 overflow-hidden rounded-lg bg-[#f1f5f9] ring-1 ring-[var(--border)]">
                        {row.mediaUrl ? (
                          <Image
                            src={row.mediaUrl}
                            alt=""
                            fill
                            className="object-cover"
                            sizes="36px"
                            unoptimized
                          />
                        ) : null}
                      </div>
                      <span className="font-medium text-[var(--foreground)]">
                        {row.community}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[var(--foreground)]">
                    {row.peopleLabel}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[var(--foreground)]">
                    {row.needL.toLocaleString("en-PH")}
                  </td>
                  <td className="px-3 py-3 tabular-nums text-[var(--foreground)]">
                    {row.localStockL.toLocaleString("en-PH")}
                  </td>
                  <td className="px-3 py-3 tabular-nums font-semibold text-[#c72929]">
                    {row.gapL.toLocaleString("en-PH")}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ring-1",
                        readinessTone(row.readiness),
                      )}
                    >
                      {row.readinessLabel}
                    </span>
                  </td>
                  <td className="px-4 py-3 sm:px-5">
                    <Link
                      href={`/admin/incidents/${encodeURIComponent(row.reportId)}`}
                      className="inline-flex rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-[12px] font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                    >
                      View details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-[var(--border)] px-4 py-2.5 text-[11px] text-[var(--muted)] sm:px-5">
          Local stock is provisional and needs field confirmation.
        </p>
      </section>

      <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#93c5fd]/70 bg-[#eff6ff] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-[#2f5f9e] uppercase">
            AI recommendation
          </p>
          <p className="mt-1 text-sm text-[var(--foreground)]">{plan.advisory}</p>
        </div>
        <Link
          href={plan.compareHref}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#254d82]"
        >
          Compare allocation options
        </Link>
      </div>

      <section className="mt-4 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
        <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
          View map
        </h2>
        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
          Request points for the open {plan.resourceLabel.toLowerCase()}{" "}
          shortage.
        </p>
        <div className="mt-3">
          <ShortagePlanMap rows={plan.rows} />
        </div>
      </section>

      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">
        Conceptual exercise data · Not a live emergency feed.
      </p>
    </div>
  );
}
