"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { fetchOnboardedBarangays } from "@/lib/onboarding/api";
import {
  hydrateOnboardedBarangays,
  listOnboardedBarangays,
} from "@/lib/onboarding/storage";
import type { OnboardedBarangay } from "@/lib/onboarding/types";
import { cn } from "@/lib/utils";

type OpsPresence = {
  areaId: string;
  barangay: string;
  lgu: string;
  activeOfficers: number;
  pendingOfficers: number;
};

export function DeveloperBarangaysPanel() {
  const [operational, setOperational] = useState<OnboardedBarangay[]>([]);
  const [presence, setPresence] = useState<OpsPresence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateOnboardedBarangays();
      if (cancelled) return;
      const rows = await fetchOnboardedBarangays().catch(() => []);
      setOperational(rows.length > 0 ? rows : listOnboardedBarangays());
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(getClientDb(), "users"), (snap) => {
      const byArea = new Map<string, OpsPresence>();
      for (const d of snap.docs) {
        const data = d.data();
        if (data.role !== "officer") continue;
        const areaId = String(
          data.activeBarangayId || data.areaId || "",
        ).trim();
        if (!areaId) continue;
        const barangay = String(data.barangay || areaId.split("/")[1] || "");
        const lgu = String(data.lgu || "");
        const row = byArea.get(areaId) ?? {
          areaId,
          barangay,
          lgu,
          activeOfficers: 0,
          pendingOfficers: 0,
        };
        const status = data.accountStatus as string | undefined;
        if (status === "pending") row.pendingOfficers += 1;
        else if (status !== "fired" && status !== "rejected") {
          row.activeOfficers += 1;
        }
        byArea.set(areaId, row);
      }
      setPresence(
        [...byArea.values()].sort((a, b) =>
          a.areaId.localeCompare(b.areaId),
        ),
      );
    });
    return () => unsub();
  }, []);

  const opsIds = useMemo(
    () => new Set(operational.map((o) => o.id)),
    [operational],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Operational barangays
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Onboarded areas ready for command. Presence counts officers with an
          area assigned (not filtered by your barangay).
        </p>
      </div>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide">
            Onboarded · operational
          </h2>
        </div>
        {loading ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">Loading…</p>
        ) : operational.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">
            None onboarded yet. Use Onboard to activate a barangay.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {operational.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--foreground)]">
                    Brgy. {row.barangay}
                    <span className="font-normal text-[var(--muted)]">
                      {" "}
                      · {row.lgu}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                    {row.id}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {row.orgName || "—"}
                    {row.hallAddress ? ` · ${row.hallAddress}` : ""}
                  </p>
                </div>
                <div className="text-right text-[11px] text-[var(--muted)]">
                  <span className="inline-flex rounded-full bg-[#ecfdf3] px-2 py-0.5 font-medium text-[#16794c] ring-1 ring-[#86efac]/50">
                    Operational
                  </span>
                  <p className="mt-1.5">
                    Activated{" "}
                    {new Date(row.activatedAt).toLocaleDateString("en-PH", {
                      timeZone: "Asia/Manila",
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="text-sm font-semibold tracking-wide">
            Areas with officer presence
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Seeded or hired officers, including areas not yet formally onboarded.
          </p>
        </div>
        {presence.length === 0 ? (
          <p className="px-4 py-8 text-sm text-[var(--muted)]">No officer areas.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {presence.map((row) => {
              const onboarded = opsIds.has(row.areaId);
              return (
                <li
                  key={row.areaId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-medium">
                      {row.barangay || row.areaId}
                      {row.lgu ? (
                        <span className="font-normal text-[var(--muted)]">
                          {" "}
                          · {row.lgu}
                        </span>
                      ) : null}
                    </p>
                    <p className="font-mono text-[11px] text-[var(--muted)]">
                      {row.areaId}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium ring-1",
                        onboarded
                          ? "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/50"
                          : "bg-[#f7f8fa] text-[var(--muted)] ring-[var(--border)]",
                      )}
                    >
                      {onboarded ? "Onboarded" : "Not onboarded"}
                    </span>
                    <span className="tabular-nums text-[var(--muted)]">
                      {row.activeOfficers} active
                      {row.pendingOfficers
                        ? ` · ${row.pendingOfficers} pending`
                        : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
