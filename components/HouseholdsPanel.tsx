"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  addHousehold,
  addHouseholds,
  ensureCuratedHouseholds,
  removeHousehold,
  seedHouseholds,
  subscribeHouseholds,
  type SeedHouseholdsProgress,
} from "@/lib/households/api";
import {
  HOUSEHOLD_CSV_TEMPLATE,
  parseHouseholdCsv,
} from "@/lib/households/csv";
import {
  CEBU_HOUSEHOLDS,
  NANGKA_CENSUS_2020,
  NANGKA_HOUSEHOLD_TARGET,
} from "@/lib/households/seed";
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

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

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
  const [seedProgress, setSeedProgress] = useState<SeedHouseholdsProgress | null>(
    null,
  );
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [purok, setPurok] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(1);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const curatedSynced = useRef(false);

  useEffect(() => {
    setLoading(true);
    curatedSynced.current = false;
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

  // Inject curated pins (Ken, etc.) into an already-seeded roster.
  useEffect(() => {
    if (loading || curatedSynced.current || rows.length === 0) return;
    curatedSynced.current = true;
    void ensureCuratedHouseholds(
      officerUid,
      orgName || "Brgy. Nangka MDRRMO",
      rows,
    ).catch(() => {
      curatedSynced.current = false;
    });
  }, [loading, rows, officerUid, orgName]);

  const rosterUpdatedAt = useMemo(() => {
    let latest = "";
    for (const h of rows) {
      const t = h.updatedAt || h.createdAt;
      if (t && t > latest) latest = t;
    }
    return latest;
  }, [rows]);

  const purokOptions = useMemo(() => {
    const set = new Set<string>();
    for (const h of rows) {
      const p = h.purok.trim();
      if (p) set.add(p);
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((h) => {
      if (purok !== "all" && h.purok.trim() !== purok) return false;
      if (!q) return true;
      const hay = [
        h.ownerName,
        h.address,
        h.purok,
        h.phone,
        h.email,
        h.notes,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, purok]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const listRows = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, purok, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
        `Replace current roster with ${NANGKA_HOUSEHOLD_TARGET.toLocaleString()} Nangka households (~${NANGKA_CENSUS_2020.toLocaleString()} people, PSA 2020)?`,
      )
    ) {
      return;
    }
    setError(null);
    setImportMsg(null);
    setSeeding(true);
    setSeedProgress({ phase: "clearing", done: 0, total: 0 });
    try {
      const count = await seedHouseholds(
        officerUid,
        orgName || "Brgy. Nangka MDRRMO",
        CEBU_HOUSEHOLDS,
        setSeedProgress,
      );
      setImportMsg(
        `Seeded ${count.toLocaleString()} households · ~${NANGKA_CENSUS_2020.toLocaleString()} people (PSA 2020 · Odette sim).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
      setSeedProgress(null);
    }
  }

  const seedLabel = seedProgress
    ? seedProgress.phase === "clearing"
      ? `Clearing ${seedProgress.done}/${seedProgress.total || "…"}…`
      : `Writing ${seedProgress.done}/${seedProgress.total}…`
    : seeding
      ? "Seeding…"
      : `Seed Nangka (${NANGKA_HOUSEHOLD_TARGET.toLocaleString()})`;

  const filtersActive = search.trim().length > 0 || purok !== "all";
  const rangeStart =
    filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);

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
                : filtersActive
                  ? `${filtered.length.toLocaleString()} match · ${rows.length.toLocaleString()} total`
                  : `${rows.length.toLocaleString()} household${rows.length === 1 ? "" : "s"}`}
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
                {seedLabel}
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
              No households yet. Add a local house owner, or seed the Nangka roster
              for the Odette simulation ({NANGKA_HOUSEHOLD_TARGET.toLocaleString()}{" "}
              households · ~{NANGKA_CENSUS_2020.toLocaleString()} people, PSA 2020).
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
                  {seedLabel}
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3 sm:px-4">
              <label className="block">
                <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Search
                </span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, address, phone, notes…"
                  className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <label className="min-w-[8rem] flex-1 sm:flex-none">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Purok
                  </span>
                  <select
                    value={purok}
                    onChange={(e) => setPurok(e.target.value)}
                    className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                  >
                    <option value="all">All puroks</option>
                    {purokOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-[7rem] flex-1 sm:flex-none">
                  <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Per page
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
                  >
                    {PAGE_SIZE_OPTIONS.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setPurok("all");
                    }}
                    className="border border-[var(--border)] px-3 py-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--foreground)]"
                  >
                    Clear
                  </button>
                ) : null}
              </div>
              <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Showing {rangeStart}–{rangeEnd} of{" "}
                {filtered.length.toLocaleString()}
                {filtersActive
                  ? ` · filtered from ${rows.length.toLocaleString()}`
                  : ""}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className="border border-dashed border-[var(--border)] px-6 py-10 text-center">
                <p className="font-medium text-[var(--foreground)]">
                  No households match
                </p>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Try another purok or search term.
                </p>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-[var(--border)] border border-[var(--border)] bg-[var(--surface-raised)]">
                  {listRows.map((h) => (
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
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {h.notes}
                          </p>
                        ) : null}
                        <p className="mt-2 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                          Updated ·{" "}
                          {formatUpdatedAt(h.updatedAt || h.createdAt)}
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

                <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5 sm:px-4">
                  <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Page {safePage} of {totalPages.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="size-4" aria-hidden />
                      Prev
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      aria-label="Next page"
                    >
                      Next
                      <ChevronRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
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
