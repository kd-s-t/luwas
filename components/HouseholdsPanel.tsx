"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addHousehold,
  addHouseholds,
  removeHousehold,
  seedHouseholds,
  subscribeHouseholds,
} from "@/lib/households/api";
import {
  HOUSEHOLD_CSV_TEMPLATE,
  parseHouseholdCsv,
} from "@/lib/households/csv";
import { CEBU_HOUSEHOLDS } from "@/lib/households/seed";
import type { Household } from "@/lib/households/types";
import { useEmulators } from "@/lib/firebase/client";

function formatUpdatedAt(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type HouseholdsPanelProps = {
  officerUid: string;
  orgName: string;
};

const emptyForm = {
  ownerName: "",
  address: "",
  purok: "",
  phone: "",
  email: "",
  notes: "",
};

export function HouseholdsPanel({ officerUid, orgName }: HouseholdsPanelProps) {
  const [rows, setRows] = useState<Household[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeHouseholds(
      officerUid,
      (next) => {
        setRows(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [officerUid]);

  const rosterUpdatedAt = useMemo(() => {
    let latest = "";
    for (const h of rows) {
      const t = h.updatedAt || h.createdAt;
      if (t && t > latest) latest = t;
    }
    return latest;
  }, [rows]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await addHousehold(officerUid, orgName, form);
      setForm(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save household");
    } finally {
      setSaving(false);
    }
  }

  async function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the barangay list?`)) return;
    try {
      await removeHousehold(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove");
    }
  }

  async function onSeedCebu() {
    if (
      rows.length > 0 &&
      !window.confirm(
        `Replace current roster with ${CEBU_HOUSEHOLDS.length} Nangka, Consolacion households?`,
      )
    ) {
      return;
    }
    setError(null);
    setImportMsg(null);
    setSeeding(true);
    try {
      await seedHouseholds(
        officerUid,
        orgName || "Brgy. Nangka MDRRMO",
        CEBU_HOUSEHOLDS,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([HOUSEHOLD_CSV_TEMPLATE], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nangka-households-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onCsvFile(file: File | null) {
    if (!file) return;
    setError(null);
    setImportMsg(null);
    setImporting(true);
    try {
      const text = await file.text();
      const parsed = parseHouseholdCsv(text);
      if (parsed.rows.length === 0) {
        setError(parsed.errors[0] ?? "No rows to import");
        return;
      }
      const count = await addHouseholds(
        officerUid,
        orgName || "Brgy. Nangka MDRRMO",
        parsed.rows,
      );
      const skipNote =
        parsed.skipped > 0 ? ` · ${parsed.skipped} row(s) skipped` : "";
      setImportMsg(`Imported ${count} household(s) from CSV${skipNote}.`);
      if (parsed.errors.length) {
        setError(parsed.errors.slice(0, 3).join(" "));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <section className="border border-[var(--border)] bg-[var(--surface-raised)] p-5 sm:p-6">
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Add household
        </p>
        <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Local house owner
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add one by one, or import a CSV for bulk insert.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={importing}
            onClick={() => csvInputRef.current?.click()}
            className="border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-2 text-sm font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
          >
            {importing ? "Importing…" : "Import CSV"}
          </button>
          <button
            type="button"
            onClick={downloadCsvTemplate}
            className="border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
          >
            Download template
          </button>
        </div>
        <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
          Columns: ownerName, address, purok, phone, email, notes, lat, lng
        </p>
        {importMsg ? (
          <p className="mt-2 text-sm text-[var(--accent)]" role="status">
            {importMsg}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="mt-5 space-y-3">
          <Field
            label="House owner name"
            required
            value={form.ownerName}
            onChange={(v) => setForm((f) => ({ ...f, ownerName: v }))}
          />
          <Field
            label="Address / landmark"
            required
            value={form.address}
            onChange={(v) => setForm((f) => ({ ...f, address: v }))}
          />
          <Field
            label="Purok / sitio"
            value={form.purok}
            onChange={(v) => setForm((f) => ({ ...f, purok: v }))}
            placeholder="e.g. Purok 3"
          />
          <Field
            label="Phone / SMS"
            required
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            placeholder="09XXXXXXXXX"
          />
          <Field
            label="Email"
            type="email"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
          />
          <label className="block text-sm">
            <span className="mb-1.5 block text-[var(--muted)]">Notes</span>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="PWD, elderly, needs meds…"
              className="w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/50"
            />
          </label>

          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[var(--accent)] px-4 py-2.5 font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
          >
            {saving ? "Saving…" : "Add to barangay list"}
          </button>
        </form>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
              Roster
            </p>
            <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
              House owners
            </h2>
            {!loading && rows.length > 0 && rosterUpdatedAt ? (
              <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                Last updated · {formatUpdatedAt(rosterUpdatedAt)}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-xs text-[var(--muted)]">
              {loading
                ? "…"
                : `${rows.length} household${rows.length === 1 ? "" : "s"}`}
            </p>
            {useEmulators ? (
              <button
                type="button"
                onClick={onSeedCebu}
                disabled={seeding || loading}
                className="border border-[var(--border)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)] disabled:opacity-50"
              >
                {seeding
                  ? "Seeding…"
                  : `Seed Nangka Consolacion (${CEBU_HOUSEHOLDS.length})`}
              </button>
            ) : null}
          </div>
        </div>

        {loading ? (
          <p className="font-mono text-sm text-[var(--muted)]">Loading roster…</p>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] bg-[var(--surface-panel)]/50 px-5 py-10 text-[var(--muted)]">
            <p>
              No households yet. Add a local house owner, or seed sample homes
              for Brgy. Nangka, Consolacion, Cebu (Purok 1–6 Access Road).
            </p>
            {useEmulators ? (
              <button
                type="button"
                onClick={onSeedCebu}
                disabled={seeding}
                className="mt-4 bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--on-accent)] transition hover:bg-[var(--accent-dim)] disabled:opacity-60"
              >
                {seeding
                  ? "Seeding…"
                  : `Seed ${CEBU_HOUSEHOLDS.length} Nangka Consolacion households`}
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--surface-raised)]">
            {rows.map((h) => (
              <li
                key={h.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
              >
                <div className="min-w-0">
                  <p className="font-medium">{h.ownerName}</p>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {h.address}
                    {h.purok ? ` · ${h.purok}` : ""}
                  </p>
                  <p className="mt-2 font-mono text-xs text-[var(--accent)]">
                    {h.phone}
                    {h.email ? ` · ${h.email}` : ""}
                  </p>
                  {h.notes ? (
                    <p className="mt-1 text-xs text-[var(--muted)]">{h.notes}</p>
                  ) : null}
                  <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                    Updated · {formatUpdatedAt(h.updatedAt || h.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(h.id, h.ownerName)}
                  className="shrink-0 self-start border border-[var(--border)] px-2.5 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--danger)] hover:text-[var(--danger)]"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block text-[var(--muted)]">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 outline-none focus:border-[var(--accent)] placeholder:text-[var(--muted)]/50"
      />
    </label>
  );
}
