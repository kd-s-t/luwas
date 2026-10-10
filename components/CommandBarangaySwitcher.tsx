"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  getPreferredAreaId,
  setPreferredAreaId,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";
import {
  hydrateOnboardedBarangays,
  listOnboardedBarangays,
} from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

export function CommandBarangaySwitcher() {
  const router = useRouter();
  const { profile, setActiveBarangay } = useAuth();
  const [rows, setRows] = useState<OnboardedBarangay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void hydrateOnboardedBarangays().then((list) => {
      setRows(list);
      const fromProfile =
        isOfficer(profile) && profile.activeBarangayId
          ? profile.activeBarangayId
          : null;
      setActiveId(fromProfile ?? getPreferredAreaId() ?? list[0]?.id ?? null);
    });
  }, [profile]);

  if (!isOfficer(profile)) return null;

  const active = rows.find((r) => r.id === activeId) ?? null;

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
          {active ? `Brgy. ${active.barangay}` : "No barangay"}
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
            {rows.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                None onboarded yet.
              </p>
            ) : (
              <ul className="max-h-56 overflow-y-auto py-1">
                {rows.map((row) => (
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
