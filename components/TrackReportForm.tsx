"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { listGuestReportIds } from "@/lib/reports/guestReportStore";
import { cn } from "@/lib/utils";

const LUW_RE = /^LUW-\d{6}-\d{4}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeRef(raw: string): string {
  return raw.trim();
}

function isValidRef(ref: string): boolean {
  return LUW_RE.test(ref) || UUID_RE.test(ref);
}

export function TrackReportForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);

  useEffect(() => {
    setSaved(listGuestReportIds());
  }, []);

  function go(ref: string) {
    const id = normalizeRef(ref);
    if (!id) {
      setError("Enter your reference number.");
      return;
    }
    if (!isValidRef(id)) {
      setError(
        "Reference must look like LUW-261015-1234, or the id from your confirmation screen.",
      );
      return;
    }
    setError(null);
    router.push(`/reports/${encodeURIComponent(id)}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    go(value);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block space-y-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">
            Reference number
          </span>
          <input
            value={value}
            onChange={(e) => {
              const next = e.target.value.trimStart();
              setValue(
                next.toUpperCase().startsWith("LUW")
                  ? next.toUpperCase()
                  : next,
              );
              setError(null);
            }}
            placeholder="LUW-261015-1234"
            autoComplete="off"
            spellCheck={false}
            className={cn(
              "w-full rounded-xl border bg-[var(--surface)] px-3 py-3 font-mono text-sm outline-none",
              error
                ? "border-[var(--danger)]"
                : "border-[var(--border)] focus:border-[var(--foreground)]/40",
            )}
          />
        </label>
        {error ? (
          <p className="text-sm text-[var(--danger)]">{error}</p>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Use the reference from your confirmation screen. It stays on this
            device in local storage.
          </p>
        )}
        <button
          type="submit"
          className="w-full rounded-[14px] bg-[var(--foreground)] px-4 py-3.5 text-[15px] font-semibold text-[var(--surface)]"
        >
          Check for updates
        </button>
      </form>

      {saved.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
            On this device
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {saved.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-[var(--surface-raised)]"
                  onClick={() => go(id)}
                >
                  <span className="truncate font-mono text-sm font-semibold">
                    {id}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">
                    Open
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
