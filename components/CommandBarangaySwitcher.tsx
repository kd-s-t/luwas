"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { officerScopeBarangay } from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { CEBU_AREA } from "@/lib/geo/cebu";
import {
  emptyChecklist,
  getPreferredAreaId,
  setPreferredAreaId,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";
import { hydrateOnboardedBarangays } from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

/** Synthetic row from officer profile when onboard list is empty. */
function profileAreaRow(
  profile: NonNullable<ReturnType<typeof useAuth>["profile"]>,
): OnboardedBarangay | null {
  if (!isOfficer(profile)) return null;
  const barangay = officerScopeBarangay(profile);
  if (!barangay) return null;
  const lgu = profile.lgu?.trim() || "Consolacion";
  const id =
    (profile.activeBarangayId ?? profile.areaId)?.trim() ||
    `${lgu.toLowerCase().replace(/\s+/g, "-")}/${barangay.toLowerCase().replace(/\s+/g, "-")}`;
  const now = profile.createdAt || new Date().toISOString();
  return {
    id,
    barangay,
    lgu,
    name: `Brgy. ${barangay}, ${lgu}`,
    orgName: profile.orgName,
    hallAddress: `Brgy. ${barangay} Hall, ${lgu}`,
    hotline: "",
    email: profile.email,
    center: { lat: CEBU_AREA.center.lat, lng: CEBU_AREA.center.lng },
    zoom: CEBU_AREA.zoom,
    checklist: emptyChecklist(),
    activatedAt: now,
    updatedAt: now,
  };
}

export function CommandBarangaySwitcher() {
  const router = useRouter();
  const { profile, setActiveBarangay } = useAuth();
  const [rows, setRows] = useState<OnboardedBarangay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const fallback = useMemo(
    () => (profile ? profileAreaRow(profile) : null),
    [profile],
  );

  useEffect(() => {
    void hydrateOnboardedBarangays().then((list) => {
      setRows(list);
      const fromProfile =
        isOfficer(profile) && profile.activeBarangayId
          ? profile.activeBarangayId
          : isOfficer(profile) && profile.areaId
            ? profile.areaId
            : null;
      setActiveId(
        fromProfile ??
          getPreferredAreaId() ??
          list[0]?.id ??
          fallback?.id ??
          null,
      );
    });
  }, [profile, fallback?.id]);

  if (!isOfficer(profile)) return null;

  const list =
    rows.length > 0 ? rows : fallback ? [fallback] : [];
  const active = list.find((r) => r.id === activeId) ?? list[0] ?? null;
  const label = active
    ? `Brgy. ${active.barangay}`
    : officerScopeBarangay(profile)
      ? `Brgy. ${officerScopeBarangay(profile)}`
      : "Pick area";

  async function select(row: OnboardedBarangay) {
    setActiveId(row.id);
    setPreferredAreaId(row.id);
    setOpen(false);
    try {
      await setActiveBarangay(row.id, row.orgName);
    } catch {
      /* local preferred area still set */
    }
    router.push(`/command?area=${encodeURIComponent(row.id)}`);
  }

  return (
    <div className="relative hidden min-w-0 sm:block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "max-w-[11rem] truncate border border-[var(--border)] px-2.5 py-1 text-left text-[11px] transition hover:border-[var(--accent)]",
          open && "border-[var(--accent)]",
        )}
      >
        <span className="block font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
          Area
        </span>
        <span className="block truncate font-medium leading-tight">
          {label}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="absolute top-full right-0 z-50 mt-1 w-56 border border-[var(--border)] bg-[var(--surface)] shadow-md"
          >
            {list.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                None onboarded yet. Use + Add barangay.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {list.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={row.id === activeId}
                      onClick={() => void select(row)}
                      className={cn(
                        "flex w-full flex-col px-3 py-2 text-left text-xs transition hover:bg-[var(--surface-panel)]/70",
                        row.id === activeId && "bg-[var(--accent)]/10",
                      )}
                    >
                      <span className="font-medium">Brgy. {row.barangay}</span>
                      <span className="text-[var(--muted)]">{row.lgu}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-[var(--border)]">
              <Link
                href="/command/onboard"
                onClick={() => setOpen(false)}
                className="block px-3 py-2 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:bg-[var(--surface-panel)]/60"
              >
                + Add barangay
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
