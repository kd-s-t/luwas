"use client";

import { useEffect, useMemo, useState } from "react";
import { officerScopeBarangay } from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import {
  DEFAULT_MAP_AREA,
  listMapAreaOptions,
  resolveKnownMapArea,
} from "@/lib/geo/mapAreas";
import {
  emptyChecklist,
  getPreferredAreaId,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";
import { hydrateOnboardedBarangays } from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

/** Synthetic row from officer profile area. */
function profileAreaRow(
  profile: NonNullable<ReturnType<typeof useAuth>["profile"]>,
): OnboardedBarangay | null {
  if (!isOfficer(profile)) return null;
  const barangay = officerScopeBarangay(profile);
  if (!barangay) return null;
  const lgu = profile.lgu?.trim() || "Consolacion";
  const id =
    (profile.areaId ?? profile.activeBarangayId)?.trim() ||
    `${lgu.toLowerCase().replace(/\s+/g, "-")}/${barangay.toLowerCase().replace(/\s+/g, "-")}`;
  const option =
    listMapAreaOptions().find((o) => o.id === id) ??
    (id === DEFAULT_MAP_AREA.id
      ? {
          id: DEFAULT_MAP_AREA.id,
          barangay: DEFAULT_MAP_AREA.barangay,
          lgu: DEFAULT_MAP_AREA.lgu,
          name: DEFAULT_MAP_AREA.name,
          label: `${DEFAULT_MAP_AREA.barangay} · ${DEFAULT_MAP_AREA.lgu}`,
        }
      : null);
  const area = option
    ? resolveKnownMapArea(option)
    : {
        ...DEFAULT_MAP_AREA,
        id,
        barangay,
        lgu,
        name: `Brgy. ${barangay}, ${lgu}`,
      };
  const now = profile.createdAt || new Date().toISOString();
  return {
    id: area.id,
    barangay: area.barangay,
    lgu: area.lgu,
    name: area.name,
    orgName: profile.orgName,
    hallAddress: `Brgy. ${area.barangay} Hall, ${area.lgu}`,
    hotline: "",
    email: profile.email,
    center: { ...area.center },
    zoom: area.zoom,
    checklist: emptyChecklist(),
    activatedAt: now,
    updatedAt: now,
  };
}

type CommandBarangaySwitcherProps = {
  /** Dark navy shell vs default light header. */
  tone?: "light" | "dark";
  className?: string;
};

/** Read-only active area label (no barangay switch dropdown). */
export function CommandBarangaySwitcher({
  tone = "light",
  className,
}: CommandBarangaySwitcherProps = {}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<OnboardedBarangay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const dark = tone === "dark";

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

  const list = useMemo(() => {
    const byId = new Map<string, OnboardedBarangay>();
    for (const row of rows) byId.set(row.id, row);
    if (fallback && !byId.has(fallback.id)) byId.set(fallback.id, fallback);
    return [...byId.values()];
  }, [rows, fallback]);

  if (!isOfficer(profile)) return null;

  const active = list.find((r) => r.id === activeId) ?? list[0] ?? null;
  const label = active
    ? `Brgy. ${active.barangay}`
    : officerScopeBarangay(profile)
      ? `Brgy. ${officerScopeBarangay(profile)}`
      : "Area";

  return (
    <div
      className={cn(
        "min-w-0",
        !dark && "hidden sm:block",
        className,
      )}
    >
      <div
        className={cn(
          "truncate px-2.5 py-1 text-left text-[11px]",
          dark
            ? "w-full max-w-none rounded-md border border-white/15"
            : "max-w-[11rem] border border-[var(--border)]",
        )}
      >
        <span
          className={cn(
            "block font-mono text-[9px] tracking-wider uppercase",
            dark ? "text-white/45" : "text-[var(--muted)]",
          )}
        >
          Area
        </span>
        <span
          className={cn(
            "block truncate font-medium leading-tight",
            dark ? "text-white" : "",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
