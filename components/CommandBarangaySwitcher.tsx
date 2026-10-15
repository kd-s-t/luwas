"use client";

import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  setPreferredAreaId,
  type OnboardedBarangay,
} from "@/lib/onboarding/types";
import { hydrateOnboardedBarangays } from "@/lib/onboarding/storage";
import { cn } from "@/lib/utils";

type PanelPos = { top?: number; bottom?: number; left: number; width: number; maxHeight: number };

/** Synthetic row from officer profile area (kept even when other barangays are onboarded). */
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

export function CommandBarangaySwitcher({
  tone = "light",
  className,
}: CommandBarangaySwitcherProps = {}) {
  const router = useRouter();
  const { profile, setActiveBarangay } = useAuth();
  const [rows, setRows] = useState<OnboardedBarangay[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<PanelPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dark = tone === "dark";
  /** Sidebar footer sits at the bottom — open the menu upward. */
  const openAbove = dark;

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

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const gap = 6;
      const width = Math.max(r.width, 224);
      if (openAbove) {
        const maxHeight = Math.max(120, r.top - gap - 12);
        setPanelPos({
          bottom: window.innerHeight - r.top + gap,
          left: r.left,
          width,
          maxHeight,
        });
      } else {
        const maxHeight = Math.max(
          120,
          window.innerHeight - r.bottom - gap - 12,
        );
        setPanelPos({
          top: r.bottom + gap,
          left: Math.min(r.right - width, window.innerWidth - width - 8),
          width,
          maxHeight,
        });
      }
    }
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, openAbove]);

  const list = useMemo(() => {
    const byId = new Map<string, OnboardedBarangay>();
    for (const row of rows) byId.set(row.id, row);
    // Profile home area (e.g. Nangka) must stay visible after onboarding Apas.
    if (fallback && !byId.has(fallback.id)) byId.set(fallback.id, fallback);
    return [...byId.values()].sort((a, b) =>
      b.activatedAt.localeCompare(a.activatedAt),
    );
  }, [rows, fallback]);

  if (!isOfficer(profile)) return null;

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
    router.push(`/admin/overview?area=${encodeURIComponent(row.id)}`);
  }

  return (
    <div className={cn("relative min-w-0", !dark && "hidden sm:block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "truncate px-2.5 py-1 text-left text-[11px] transition",
          dark
            ? "w-full max-w-none rounded-md border border-white/15 hover:border-white/35"
            : "max-w-[11rem] border border-[var(--border)] hover:border-[var(--accent)]",
          open && (dark ? "border-white/40" : "border-[var(--accent)]"),
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
      </button>

      {open && panelPos ? (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-[90] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            className="fixed z-[100] flex flex-col overflow-hidden border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-lg"
            style={{
              left: panelPos.left,
              width: panelPos.width,
              maxHeight: panelPos.maxHeight,
              ...(panelPos.bottom != null
                ? { bottom: panelPos.bottom }
                : { top: panelPos.top }),
            }}
          >
            {list.length === 0 ? (
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                None onboarded yet. Use + Add barangay.
              </p>
            ) : (
              <ul className="min-h-0 flex-1 overflow-y-auto py-1">
                {list.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={row.id === activeId}
                      onClick={() => void select(row)}
                      className={cn(
                        "flex w-full flex-col px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-panel)]/70",
                        row.id === activeId && "bg-[var(--accent)]/10",
                      )}
                    >
                      <span className="font-medium text-[var(--foreground)]">
                        Brgy. {row.barangay}
                      </span>
                      <span className="text-[var(--muted)]">{row.lgu}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
