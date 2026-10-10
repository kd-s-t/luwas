"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, Loader2, MapPin, Search } from "lucide-react";
import {
  filterMapAreaOptions,
  listMapAreaOptions,
  type MapArea,
  type MapAreaOption,
} from "@/lib/geo/mapAreas";
import { cn } from "@/lib/utils";

type AreaSearchSelectProps = {
  value: MapArea;
  onChange: (area: MapArea) => void;
  className?: string;
};

const ALL_OPTIONS = listMapAreaOptions();

export function AreaSearchSelect({
  value,
  onChange,
  className,
}: AreaSearchSelectProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [resolving, setResolving] = useState(false);

  const results = useMemo(
    () => filterMapAreaOptions(ALL_OPTIONS, query, 48),
    [query],
  );

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query, open]);

  async function selectOption(option: MapAreaOption) {
    setResolving(true);
    setOpen(false);
    setQuery("");
    try {
      // Prefer hall pin from barangay onboarding when present.
      const { getOnboardedBarangay } = await import(
        "@/lib/onboarding/storage"
      );
      const onboarded = getOnboardedBarangay(option.id);
      if (onboarded) {
        onChange({
          id: option.id,
          barangay: option.barangay,
          lgu: option.lgu,
          name: option.name,
          center: { ...onboarded.center },
          zoom: onboarded.zoom,
        });
        return;
      }

      const res = await fetch("/api/geo/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(option),
      });
      if (!res.ok) throw new Error("resolve failed");
      const area = (await res.json()) as MapArea;
      onChange(area);
    } catch {
      // Client-side known fallback without network
      const { resolveKnownMapArea } = await import("@/lib/geo/mapAreas");
      onChange(resolveKnownMapArea(option));
    } finally {
      setResolving(false);
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
      setOpen(true);
      return;
    }
    if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      void selectOption(results[active]!);
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative z-50 min-w-0", open && "z-[1000]", className)}
    >
      <button
        type="button"
        disabled={resolving}
        onClick={() => {
          setOpen((o) => !o);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="group flex w-full max-w-xl items-center gap-2 text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
      >
        <h2 className="min-w-0 font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
          <span className="truncate">{value.name}</span>
        </h2>
        {resolving ? (
          <Loader2
            className="size-4 shrink-0 animate-spin text-[var(--accent)]"
            aria-hidden
          />
        ) : (
          <ChevronsUpDown
            className="size-4 shrink-0 text-[var(--muted)] transition group-hover:text-[var(--accent)]"
            aria-hidden
          />
        )}
      </button>
      <p className="mt-0.5 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
        Switch barangay map
      </p>

      {open ? (
        <div className="absolute left-0 top-full z-[1001] mt-1 w-[min(100vw-2rem,22rem)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_16px_40px_rgba(31,33,38,0.18)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Search className="size-3.5 shrink-0 text-[var(--muted)]" aria-hidden />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search barangay or LGU…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
              aria-autocomplete="list"
              aria-controls={listId}
              aria-activedescendant={
                results[active] ? `${listId}-${results[active]!.id}` : undefined
              }
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {results.length === 0 ? (
              <li className="px-3 py-3 text-sm text-[var(--muted)]">
                No barangays match.
              </li>
            ) : (
              results.map((opt, i) => {
                const selected = opt.id === value.id;
                return (
                  <li key={opt.id} id={`${listId}-${opt.id}`} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => void selectOption(opt)}
                      className={cn(
                        "flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition",
                        i === active
                          ? "bg-[var(--surface-panel)]"
                          : "hover:bg-[var(--surface-raised)]",
                      )}
                    >
                      <MapPin
                        className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-[var(--foreground)]">
                          {opt.barangay}
                        </span>
                        <span className="block text-xs text-[var(--muted)]">
                          {opt.lgu}, Cebu
                        </span>
                      </span>
                      {selected ? (
                        <Check
                          className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
