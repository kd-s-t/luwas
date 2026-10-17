"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EvacStockList } from "@/components/EvacStockList";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ensureApasEvacCenters,
  ensureNangkaEvacCenters,
  subscribeEvacCenters,
} from "@/lib/evacCenters/api";
import { APAS_BARANGAY_DOC_ID } from "@/lib/evacCenters/apasSeed";
import { NANGKA_BARANGAY_ID } from "@/lib/evacCenters/nangkaSeed";
import { resolveEvacBarangayFromProfile } from "@/lib/evacCenters/resolve";
import {
  evacConditionLabel,
  formatEvacUpdatedAt,
  isEvacCenterUnusable,
  type EvacCenter,
  type EvacCenterCondition,
} from "@/lib/evacCenters/types";
import { cn } from "@/lib/utils";

function conditionClass(condition: EvacCenterCondition): string {
  switch (condition) {
    case "flooded":
      return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
    case "collapsed":
      return "bg-[#fef2f2] text-[#b91c1c] ring-[#fca5a5]/70";
    case "unusable":
      return "bg-[#fef2f2] text-[#991b1b] ring-[#fecaca]/80";
    default:
      return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
}

/** Opens Google Maps directions to the shelter (origin = user’s current location when available). */
function evacDirectionsUrl(row: EvacCenter): string {
  if (Number.isFinite(row.lat) && Number.isFinite(row.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${row.lat},${row.lng}&travelmode=driving`;
  }
  const q = encodeURIComponent(
    [row.name, row.locationLabel].filter(Boolean).join(", "),
  );
  return `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=driving`;
}

export function PublicEvacCentersList() {
  const { profile } = useAuth();
  const scope = useMemo(
    () => resolveEvacBarangayFromProfile(profile),
    [profile],
  );
  const [rows, setRows] = useState<EvacCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    setLoading(true);
    setError(null);
    return subscribeEvacCenters(
      scope.barangayId,
      (next) => {
        setRows(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [scope.barangayId]);

  useEffect(() => {
    if (seeded.current) return;
    seeded.current = true;
    const run =
      scope.barangayId === APAS_BARANGAY_DOC_ID
        ? ensureApasEvacCenters()
        : scope.barangayId === NANGKA_BARANGAY_ID
          ? ensureNangkaEvacCenters()
          : Promise.resolve();
    void run.catch(() => {
      seeded.current = false;
    });
  }, [scope.barangayId]);

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--muted)]">
        Shelters for Brgy. {scope.label}
        {scope.lgu ? `, ${scope.lgu}` : ""}. Based on your registered location.
      </p>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">
          Loading evacuation centers…
        </p>
      ) : error ? null : rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">
          No evacuation centers listed for this barangay yet.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          {rows.map((row, i) => (
            <FadeIn key={row.id} y={8} delay={Math.min(i * 0.04, 0.2)}>
              <li className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-[var(--foreground)]">
                    {row.name}
                  </p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                      conditionClass(row.condition),
                    )}
                  >
                    {evacConditionLabel(row.condition)}
                  </span>
                  {row.open24h ? (
                    <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-semibold text-[#16794c] ring-1 ring-[#86efac]/60">
                      24h
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  {row.locationLabel || "Location on file"}
                </p>
                <a
                  href={evacDirectionsUrl(row)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-sm font-medium text-[#2f5f9e] transition hover:underline"
                >
                  Directions
                </a>
                {isEvacCenterUnusable(row.condition) ? (
                  <p className="mt-1 text-sm text-[#9a3412]">
                    Do not go here
                  </p>
                ) : null}
                {formatEvacUpdatedAt(row.updatedAt) ? (
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    Last updated {formatEvacUpdatedAt(row.updatedAt)}
                  </p>
                ) : null}
                <div className="mt-2">
                  <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
                    On site
                  </p>
                  <EvacStockList
                    stock={row.stock}
                    occupancy={row.occupancy}
                    capacity={row.maxCapacity}
                  />
                </div>
                {row.notes ? (
                  <p className="mt-1 text-[12px] text-[var(--muted)]">
                    {row.notes}
                  </p>
                ) : null}
              </li>
            </FadeIn>
          ))}
        </ul>
      )}
    </div>
  );
}
