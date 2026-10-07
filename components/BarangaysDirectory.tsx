"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { ResponderStationsList } from "@/components/ResponderStationsList";
import {
  CEBU_BARANGAY_INDEX,
  lguKindLabel,
  slugify,
  type CebuLgu,
  type LguKind,
} from "@/lib/geo/cebuBarangays";
import { respondersForLgu } from "@/lib/geo/responderStations";
import { cn } from "@/lib/utils";

const KIND_ORDER: LguKind[] = [
  "highly_urbanized_city",
  "component_city",
  "municipality",
];

const DEFAULT_OPEN = "Consolacion";

type KindFilter = "all" | LguKind;

type LguRow = {
  lgu: CebuLgu;
  barangays: string[];
};

function groupByKind(rows: LguRow[]) {
  return KIND_ORDER.map((kind) => ({
    kind,
    rows: rows.filter((r) => r.lgu.kind === kind),
  })).filter((g) => g.rows.length > 0);
}

function matchesQuery(text: string, q: string) {
  return text.toLowerCase().includes(q);
}

export function BarangaysDirectory() {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [openNames, setOpenNames] = useState<Set<string>>(
    () => new Set([DEFAULT_OPEN]),
  );
  const q = query.trim().toLowerCase();

  const filteredRows = useMemo(() => {
    return CEBU_BARANGAY_INDEX.lgus
      .filter((lgu) => kindFilter === "all" || lgu.kind === kindFilter)
      .map((lgu) => {
        if (!q) {
          return { lgu, barangays: lgu.barangays };
        }
        const lguMatch = matchesQuery(lgu.name, q);
        const barangays = lguMatch
          ? lgu.barangays
          : lgu.barangays.filter((b) => matchesQuery(b, q));
        return { lgu, barangays };
      })
      .filter((row) => row.barangays.length > 0);
  }, [kindFilter, q]);

  const groups = useMemo(() => groupByKind(filteredRows), [filteredRows]);

  const visibleBarangayCount = useMemo(
    () => filteredRows.reduce((n, r) => n + r.barangays.length, 0),
    [filteredRows],
  );

  const searching = q.length > 0;

  function isOpen(name: string) {
    return searching || openNames.has(name);
  }

  function toggle(name: string) {
    if (searching) return;
    setOpenNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function jumpTo(name: string) {
    if (!searching) {
      setOpenNames((prev) => new Set(prev).add(name));
    }
    const el = document.getElementById(`lgu-${slugify(name)}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function expandAll() {
    setOpenNames(new Set(filteredRows.map((r) => r.lgu.name)));
  }

  function collapseAll() {
    setOpenNames(new Set());
  }

  const kindTabs: { id: KindFilter; label: string }[] = [
    { id: "all", label: "All LGUs" },
    { id: "highly_urbanized_city", label: "HUC" },
    { id: "component_city", label: "Cities" },
    { id: "municipality", label: "Municipalities" },
  ];

  return (
    <div className="space-y-6">
      <div className="sticky top-[3.25rem] z-20 -mx-4 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="flex min-w-0 flex-1 items-center gap-2 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
            <Search
              className="size-3.5 shrink-0 text-[var(--muted)]"
              aria-hidden
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search barangay or LGU…"
              className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
              aria-label="Search barangay or LGU"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="shrink-0 text-[var(--muted)] transition hover:text-[var(--foreground)]"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {kindTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setKindFilter(tab.id)}
                className={cn(
                  "border px-2.5 py-1 font-mono text-[10px] tracking-wide uppercase transition",
                  kindFilter === tab.id
                    ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                    : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
            {filteredRows.length} LGUs · {visibleBarangayCount.toLocaleString()}{" "}
            barangays
            {searching ? " · matching" : null}
          </p>
          {!searching ? (
            <div className="flex gap-3 font-mono text-[10px] tracking-wide uppercase">
              <button
                type="button"
                onClick={expandAll}
                className="text-[var(--accent)] underline-offset-2 hover:underline"
              >
                Expand all
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-[var(--muted)] underline-offset-2 hover:underline"
              >
                Collapse all
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <p className="border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          No barangays match “{query.trim()}”.
        </p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-start">
          <nav
            aria-label="Jump to LGU"
            className="lg:sticky lg:top-[9.5rem] lg:max-h-[calc(100vh-10.5rem)] lg:overflow-y-auto"
          >
            <p className="mb-2 font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
              Jump to
            </p>
            <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
              {filteredRows.map(({ lgu }) => (
                <li key={lgu.name} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => jumpTo(lgu.name)}
                    className={cn(
                      "w-full border px-2.5 py-1.5 text-left text-sm transition lg:border-0 lg:border-l-2 lg:px-3 lg:py-1",
                      openNames.has(lgu.name) && !searching
                        ? "border-[var(--accent)] text-[var(--accent)] lg:border-l-[var(--accent)]"
                        : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] lg:border-l-transparent lg:hover:border-l-[var(--accent)]",
                    )}
                  >
                    <span className="block truncate">{lgu.name}</span>
                    <span className="hidden font-mono text-[9px] tracking-wider uppercase lg:block">
                      {lgu.barangays.length}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-8">
            {groups.map(({ kind, rows }) => (
              <section key={kind} aria-labelledby={`kind-${kind}`}>
                <h2
                  id={`kind-${kind}`}
                  className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase"
                >
                  {lguKindLabel(kind)}
                </h2>
                <ul className="mt-3 space-y-3">
                  {rows.map(({ lgu, barangays }) => {
                    const open = isOpen(lgu.name);
                    const panelId = `lgu-panel-${slugify(lgu.name)}`;
                    return (
                      <li
                        key={lgu.name}
                        id={`lgu-${slugify(lgu.name)}`}
                        className="scroll-mt-40 border border-[var(--border)] bg-[var(--surface-raised)]"
                      >
                        <button
                          type="button"
                          onClick={() => toggle(lgu.name)}
                          aria-expanded={open}
                          aria-controls={panelId}
                          disabled={searching}
                          className={cn(
                            "flex w-full flex-wrap items-center justify-between gap-2 px-4 py-3 text-left transition",
                            searching
                              ? "cursor-default"
                              : "hover:bg-[var(--surface-panel)]/60",
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
                              {lgu.name}
                            </span>
                            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                              {searching
                                ? `${barangays.length} of ${lgu.barangays.length} barangays`
                                : `${lgu.barangays.length} barangays`}
                            </span>
                          </span>
                          <ChevronDown
                            className={cn(
                              "size-4 shrink-0 text-[var(--muted)] transition",
                              open && "rotate-180",
                              searching && "opacity-40",
                            )}
                            aria-hidden
                          />
                        </button>

                        {open ? (
                          <div id={panelId}>
                            <ResponderStationsList
                              stations={respondersForLgu(lgu.name)}
                              compact
                            />
                            <ul className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-4">
                              {barangays.map((b) => {
                                const href = `/barangays/${slugify(lgu.name)}/${slugify(b)}`;
                                const highlight =
                                  lgu.name === "Consolacion" && b === "Nangka";
                                return (
                                  <li key={b}>
                                    <Link
                                      href={href}
                                      className={cn(
                                        "inline-block border px-2.5 py-1 text-sm transition",
                                        highlight
                                          ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                                          : "border-[var(--border)] text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
                                      )}
                                    >
                                      {b}
                                    </Link>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
