"use client";

import { Plus } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [open, setOpen] = useState(false);
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

  function openModal() {
    setError(null);
    setImportMsg(null);
    setOpen(true);
  }

  function closeModal(next = false) {
    setOpen(next);
    if (!next) {
      setForm(emptyForm);
      setError(null);
      setImportMsg(null);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await addHousehold(officerUid, orgName, form);
      setForm(emptyForm);
      setOpen(false);
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
    <div>
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
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs text-[var(--muted)]">
              {loading
                ? "…"
                : `${rows.length} household${rows.length === 1 ? "" : "s"}`}
            </p>
            <Button type="button" size="sm" onClick={openModal}>
              <Plus className="size-4" aria-hidden />
              Add household
            </Button>
            {useEmulators ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSeedCebu}
                disabled={seeding || loading}
              >
                {seeding
                  ? "Seeding…"
                  : `Seed Nangka (${CEBU_HOUSEHOLDS.length})`}
              </Button>
            ) : null}
          </div>
        </div>

        {error && !open ? (
          <p className="mb-3 text-sm text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="font-mono text-sm text-[var(--muted)]">Loading roster…</p>
        ) : rows.length === 0 ? (
          <div className="border border-dashed border-[var(--border)] bg-[var(--surface-panel)]/50 px-5 py-10 text-[var(--muted)]">
            <p>
              No households yet. Add a local house owner, or seed sample homes
              for Brgy. Nangka, Consolacion, Cebu.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={openModal}>
                <Plus className="size-4" aria-hidden />
                Add household
              </Button>
              {useEmulators ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onSeedCebu}
                  disabled={seeding}
                >
                  {seeding
                    ? "Seeding…"
                    : `Seed ${CEBU_HOUSEHOLDS.length} Nangka households`}
                </Button>
              ) : null}
            </div>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemove(h.id, h.ownerName)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={closeModal}>
        <DialogContent>
          <DialogHeader>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Add household
            </p>
            <DialogTitle>Local house owner</DialogTitle>
            <DialogDescription>
              Add one by one, or import a CSV for bulk insert.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => onCsvFile(e.target.files?.[0] ?? null)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={importing}
                onClick={() => csvInputRef.current?.click()}
                className="border-[var(--accent)] text-[var(--accent)] hover:border-[var(--accent)]"
              >
                {importing ? "Importing…" : "Import CSV"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadCsvTemplate}
              >
                Download template
              </Button>
            </div>
            <p className="font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
              Columns: ownerName, address, purok, phone, email, notes, lat, lng
            </p>
            {importMsg ? (
              <p className="text-sm text-[var(--accent)]" role="status">
                {importMsg}
              </p>
            ) : null}

            <form id="add-household-form" onSubmit={onSubmit} className="space-y-3">
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
            </form>
          </DialogBody>

          <DialogFooter>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => closeModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="add-household-form"
                disabled={saving}
              >
                {saving ? "Saving…" : "Add to barangay list"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
