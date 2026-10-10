"use client";

import { useMemo, useState } from "react";
import {
  filterMapAreaOptions,
  listMapAreaOptions,
  type MapAreaOption,
} from "@/lib/geo/mapAreas";

export type RegisterLocation = {
  areaId: string;
  barangay: string;
  lgu: string;
  label: string;
};

type RegisterLocationFieldsProps = {
  value: RegisterLocation | null;
  onChange: (next: RegisterLocation) => void;
  disabled?: boolean;
  /** Prefill search, e.g. "Nangka". */
  defaultQuery?: string;
};

export function RegisterLocationFields({
  value,
  onChange,
  disabled,
  defaultQuery = "Nangka",
}: RegisterLocationFieldsProps) {
  const all = useMemo(() => listMapAreaOptions(), []);
  const [query, setQuery] = useState(defaultQuery);
  const options = useMemo(
    () => filterMapAreaOptions(all, query, 24),
    [all, query],
  );

  function pick(opt: MapAreaOption) {
    onChange({
      areaId: opt.id,
      barangay: opt.barangay,
      lgu: opt.lgu,
      label: opt.label,
    });
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        <span className="mb-1.5 block text-[var(--muted)]">
          Barangay / location
        </span>
        <input
          type="search"
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search barangay…"
          className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
        />
      </label>
      {value ? (
        <p className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
          Selected · {value.label}
        </p>
      ) : (
        <p className="text-xs text-[var(--muted)]">
          Pick your home barangay so officers can validate your account.
        </p>
      )}
      <ul className="max-h-40 overflow-y-auto border border-[var(--border)]">
        {options.map((opt) => {
          const active = value?.areaId === opt.id;
          return (
            <li key={opt.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => pick(opt)}
                className={`flex w-full px-3 py-2 text-left text-sm transition ${
                  active
                    ? "bg-[var(--accent)] text-[var(--on-accent)]"
                    : "hover:bg-[var(--surface-panel)]"
                }`}
              >
                {opt.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
