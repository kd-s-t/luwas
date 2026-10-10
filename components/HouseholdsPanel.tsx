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
  updateHouseholdMembers,
} from "@/lib/households/api";
import {
  HOUSEHOLD_CSV_TEMPLATE,
  parseHouseholdCsv,
} from "@/lib/households/csv";
import {
  officerScopeBarangay,
  subscribeBarangayUsers,
} from "@/lib/auth/accountValidation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { ensureKenHouseholdCitizens } from "@/lib/auth/ensureKenHouseholdCitizens";
import { isCitizen, isOfficer } from "@/lib/auth/types";
import {
  dedupeHouseholdsByContact,
  healHouseholdCitizenLinks,
} from "@/lib/households/match";
import {
  CEBU_HOUSEHOLDS,
  NANGKA_HOUSEHOLD_TARGET,
} from "@/lib/households/seed";
import {
  householdAppUserStatus,
  type Household,
} from "@/lib/households/types";
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

function lastLocationLabel(
  h: Pick<
    Household,
    | "lastSeenAt"
    | "lastSeenArea"
    | "lastSeenLat"
    | "lastSeenLng"
    | "presence"
  >,
): { text: string; mapsUrl: string | null; tone: "away" | "muted" } {
  if (!h.lastSeenAt) {
    return {
      text: "No citizen location yet",
      mapsUrl: null,
      tone: "muted",
    };
  }
  const parts = [formatUpdatedAt(h.lastSeenAt)];
  if (h.lastSeenArea) parts.push(h.lastSeenArea);
  if (h.lastSeenLat != null && h.lastSeenLng != null) {
    parts.push(`${h.lastSeenLat.toFixed(5)}, ${h.lastSeenLng.toFixed(5)}`);
  }
  return {
    text: parts.join(" · "),
    mapsUrl:
      h.lastSeenLat != null && h.lastSeenLng != null
        ? `https://www.google.com/maps?q=${h.lastSeenLat},${h.lastSeenLng}`
        : null,
    tone: h.presence === "away" ? "away" : "muted",
  };
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
  const { profile } = useAuth();
  const [rows, setRows] = useState<Household[]>([]);
  const [citizenEmails, setCitizenEmails] = useState<Set<string>>(new Set());
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [purok, setPurok] = useState("all");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_DEFAULT);
  const [page, setPage] = useState(1);
  const [deduping, setDeduping] = useState(false);
  const [membersEditId, setMembersEditId] = useState<string | null>(null);
  const [membersOwnerName, setMembersOwnerName] = useState("");
  const [membersOwnerPhone, setMembersOwnerPhone] = useState("");
  const [membersOwnerEmail, setMembersOwnerEmail] = useState("");
  const [membersLastLocation, setMembersLastLocation] = useState<{
    text: string;
    mapsUrl: string | null;
    tone: "away" | "muted";
  } | null>(null);
  const [membersRows, setMembersRows] = useState<
    { name: string; relation: string; phone: string; email: string }[]
  >([]);
  const [membersSaving, setMembersSaving] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const curatedSynced = useRef(false);
  const healPass = useRef(false);
  const dedupePass = useRef(false);
  const trimPass = useRef(false);

  useEffect(() => {
    setLoading(true);
    curatedSynced.current = false;
    healPass.current = false;
    dedupePass.current = false;
    trimPass.current = false;
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

  // Shrink oversized PSA-style rosters (~2.9k) down to house-owner target (~1.5k).
  useEffect(() => {
    if (loading || trimPass.current) return;
    if (rows.length <= NANGKA_HOUSEHOLD_TARGET + 50) return;
    trimPass.current = true;
    void seedHouseholds(
      officerUid,
      orgName || "Brgy. Nangka MDRRMO",
      CEBU_HOUSEHOLDS,
    ).catch(() => {
      trimPass.current = false;
    });
  }, [loading, rows.length, officerUid, orgName]);

  useEffect(() => {
    if (!isOfficer(profile)) {
      setCitizenEmails(new Set());
      return;
    }
    const barangay = officerScopeBarangay(profile);
    const areaId = profile.areaId ?? profile.activeBarangayId;
    return subscribeBarangayUsers(
      barangay,
      (users) => {
        const emails = new Set<string>();
        for (const u of users) {
          if (!isCitizen(u)) continue;
          if (u.accountStatus === "fired" || u.accountStatus === "rejected") {
            continue;
          }
          const e = u.email.trim().toLowerCase();
          if (e) emails.add(e);
        }
        setCitizenEmails(emails);
      },
      undefined,
      areaId,
    );
  }, [profile]);

  // Inject curated pins (Ken, etc.) into an already-seeded roster,
  // then register Ken + Jeanilou as linked citizen app users.
  useEffect(() => {
    if (loading || curatedSynced.current || rows.length === 0) return;
    curatedSynced.current = true;
    void ensureCuratedHouseholds(
      officerUid,
      orgName || "Brgy. Nangka MDRRMO",
      rows,
    )
      .then(() => ensureKenHouseholdCitizens())
      .catch(() => {
        curatedSynced.current = false;
      });
  }, [loading, rows, officerUid, orgName]);

  // If citizens already exist (Ken registered) but the house badge still says
  // Not registered, write linkedCitizenUids from users → households.
  useEffect(() => {
    if (loading || healPass.current || rows.length === 0) return;
    if (citizenEmails.size === 0) return;
    const targets = rows.filter((h) => {
      if ((h.linkedCitizenUids?.length ?? 0) > 0) return false;
      const email = h.email.trim().toLowerCase();
      return Boolean(email && citizenEmails.has(email));
    });
    if (targets.length === 0) return;
    healPass.current = true;
    void healHouseholdCitizenLinks(targets).catch(() => {
      healPass.current = false;
    });
  }, [loading, rows, citizenEmails]);

  // If twin Kens still appear (same email / pin), force-merge immediately.
  useEffect(() => {
    if (loading || rows.length < 2 || dedupePass.current) return;
    const emails = new Map<string, number>();
    const pins = new Map<string, number>();
    for (const h of rows) {
      const e = h.email.trim().toLowerCase();
      if (e) emails.set(e, (emails.get(e) ?? 0) + 1);
      if (h.lat != null && h.lng != null) {
        const k = `${h.ownerName.trim().toLowerCase()}|${h.lat.toFixed(5)},${h.lng.toFixed(5)}`;
        pins.set(k, (pins.get(k) ?? 0) + 1);
      }
    }
    const hasDup =
      [...emails.values()].some((n) => n > 1) ||
      [...pins.values()].some((n) => n > 1);
    if (!hasDup) return;
    dedupePass.current = true;
    void dedupeHouseholdsByContact(officerUid)
      .then(({ removed }) => {
        if (removed > 0) {
          setImportMsg(`Merged ${removed} duplicate house-owner row(s).`);
        }
      })
      .catch(() => {
        dedupePass.current = false;
      });
  }, [loading, rows, officerUid]);

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
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={deduping || loading || rows.length === 0}
              onClick={() => {
                setDeduping(true);
                setError(null);
                void dedupeHouseholdsByContact(officerUid)
                  .then(({ removed }) => {
                    setImportMsg(
                      removed > 0
                        ? `Merged ${removed} duplicate house-owner row(s).`
                        : "No duplicate contacts found.",
                    );
                  })
                  .catch((err) => {
                    setError(
                      err instanceof Error ? err.message : "Dedupe failed",
                    );
                  })
                  .finally(() => setDeduping(false));
              }}
            >
              {deduping ? "Merging…" : "Merge duplicates"}
            </Button>
            <Button type="button" size="sm" onClick={openModal}>
              <Plus className="size-4" aria-hidden />
              Add household
            </Button>
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
            <p>No households yet. Add a local house owner to start the roster.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={openModal}>
                <Plus className="size-4" aria-hidden />
                Add household
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex w-full min-w-0 items-center gap-2 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, address, phone…"
                aria-label="Search households"
                className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--input)] px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              />
              <select
                value={purok}
                onChange={(e) => setPurok(e.target.value)}
                aria-label="Filter by purok"
                className="w-[8.5rem] shrink-0 border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
              >
                <option value="all">All puroks</option>
                {purokOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                aria-label="Rows per page"
                className="w-[4.5rem] shrink-0 border border-[var(--border)] bg-[var(--input)] px-2 py-1.5 font-mono text-xs outline-none focus:border-[var(--accent)]"
              >
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}/page
                  </option>
                ))}
              </select>
              {filtersActive ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPurok("all");
                  }}
                  className="shrink-0 px-2 py-1.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--foreground)]"
                >
                  Clear
                </button>
              ) : null}
              <p className="hidden shrink-0 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:block">
                {rangeStart}–{rangeEnd} of {filtered.length.toLocaleString()}
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
                  {listRows.map((h) => {
                    const app = householdAppUserStatus(h, 0, citizenEmails);
                    const isOfficerHouse =
                      (h.linkedOfficerUids?.length ?? 0) > 0;
                    const memberCount = 1 + (h.members?.length ?? 0);
                    const memberNames = (h.members ?? [])
                      .map((m) => m.name)
                      .filter(Boolean);
                    const purok = h.purok.trim();
                    const address = h.address.trim();
                    const placeLine =
                      purok &&
                      address.toLowerCase().includes(purok.toLowerCase())
                        ? address
                        : [purok, address].filter(Boolean).join(" · ");
                    const mapsUrl =
                      h.lat != null && h.lng != null
                        ? `https://www.google.com/maps?q=${h.lat},${h.lng}`
                        : null;
                    const lastLoc = lastLocationLabel(h);

                    return (
                      <li key={h.id} className="px-4 py-4 sm:px-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <p className="font-medium text-[var(--foreground)]">
                                {h.ownerName}
                              </p>
                              {isOfficerHouse ? (
                                <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                                  Officer
                                </span>
                              ) : app === "registered" ? (
                                <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                                  App user
                                </span>
                              ) : (
                                <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                                  No app
                                </span>
                              )}
                              {h.presence === "away" ? (
                                <span className="font-mono text-[10px] tracking-wider text-[var(--warn)] uppercase">
                                  Away
                                </span>
                              ) : h.presence === "home" ? (
                                <span className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                                  At home
                                </span>
                              ) : null}
                            </div>
                            {placeLine ? (
                              <p className="mt-0.5 truncate text-sm text-[var(--muted)]">
                                {placeLine}
                              </p>
                            ) : null}
                            <p className="mt-1 font-mono text-xs text-[var(--muted)]">
                              {[h.phone, h.email].filter(Boolean).join(" · ") ||
                                "No contact"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() => onRemove(h.id, h.ownerName)}
                          >
                            Remove
                          </Button>
                        </div>

                        <div className="mt-3 space-y-1.5 border-t border-[var(--border)]/60 pt-2.5 text-xs">
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                            <button
                              type="button"
                              className="text-[var(--foreground)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
                              onClick={() => {
                                setMembersEditId(h.id);
                                setMembersOwnerName(h.ownerName);
                                setMembersOwnerPhone(h.phone ?? "");
                                setMembersOwnerEmail(h.email ?? "");
                                setMembersLastLocation(lastLoc);
                                setMembersRows(
                                  (h.members ?? []).map((m) => ({
                                    name: m.name ?? "",
                                    relation: m.relation ?? "",
                                    phone: m.phone ?? "",
                                    email: m.email ?? "",
                                  })),
                                );
                              }}
                            >
                              {memberCount} in household
                              {memberNames.length
                                ? ` · ${memberNames.join(", ")}`
                                : ""}
                            </button>
                            {mapsUrl ? (
                              <a
                                href={mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-mono text-[var(--accent)] underline-offset-2 hover:underline"
                              >
                                Home map
                              </a>
                            ) : (
                              <span className="font-mono text-[var(--muted)]">
                                No home pin
                              </span>
                            )}
                            <span className="ml-auto font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                              {formatUpdatedAt(h.updatedAt || h.createdAt)}
                            </span>
                          </div>
                          <p
                            className={
                              lastLoc.tone === "away"
                                ? "text-[var(--warn)]"
                                : "text-[var(--muted)]"
                            }
                          >
                            <span className="font-mono text-[10px] tracking-wider uppercase">
                              Last location
                            </span>
                            {" · "}
                            {lastLoc.mapsUrl ? (
                              <a
                                href={lastLoc.mapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--accent)] underline-offset-2 hover:underline"
                              >
                                {lastLoc.text}
                              </a>
                            ) : (
                              lastLoc.text
                            )}
                          </p>
                        </div>
                      </li>
                    );
                  })}
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

      <Dialog
        open={membersEditId != null}
        onOpenChange={(next) => {
          if (!next) {
            setMembersEditId(null);
            setMembersOwnerName("");
            setMembersOwnerPhone("");
            setMembersOwnerEmail("");
            setMembersLastLocation(null);
            setMembersRows([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Household members</DialogTitle>
            <DialogDescription>
              {membersOwnerName
                ? `${membersOwnerName} (owner) plus people and pets in the house.`
                : "People and pets in the house besides the owner."}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-3">
            <div className="overflow-x-auto border border-[var(--border)]">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  <tr>
                    <th className="px-2.5 py-2 font-medium">Name</th>
                    <th className="px-2.5 py-2 font-medium">Relation</th>
                    <th className="px-2.5 py-2 font-medium">Phone</th>
                    <th className="px-2.5 py-2 font-medium">Email</th>
                    <th className="px-2.5 py-2 font-medium">Last location</th>
                    <th className="w-20 px-2.5 py-2 font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-[var(--border)]/70 bg-[var(--surface-panel)]/40">
                    <td className="px-2.5 py-2 font-medium">
                      {membersOwnerName || "—"}
                    </td>
                    <td className="px-2.5 py-2 text-[var(--muted)]">Owner</td>
                    <td className="px-2.5 py-2 font-mono text-xs">
                      {membersOwnerPhone || "—"}
                    </td>
                    <td className="px-2.5 py-2 break-all font-mono text-xs">
                      {membersOwnerEmail || "—"}
                    </td>
                    <td
                      className={
                        membersLastLocation?.tone === "away"
                          ? "px-2.5 py-2 text-xs text-[var(--warn)]"
                          : "px-2.5 py-2 text-xs text-[var(--muted)]"
                      }
                    >
                      {membersLastLocation?.mapsUrl ? (
                        <a
                          href={membersLastLocation.mapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--accent)] underline-offset-2 hover:underline"
                        >
                          {membersLastLocation.text}
                        </a>
                      ) : (
                        (membersLastLocation?.text ?? "—")
                      )}
                    </td>
                    <td className="px-2.5 py-2" />
                  </tr>
                  {membersRows.length === 0 ? (
                    <tr className="border-t border-[var(--border)]/70">
                      <td
                        colSpan={6}
                        className="px-2.5 py-6 text-center text-xs text-[var(--muted)]"
                      >
                        No other members yet. Add a person or pet.
                      </td>
                    </tr>
                  ) : (
                    membersRows.map((row, idx) => (
                      <tr
                        key={`member-${idx}`}
                        className="border-t border-[var(--border)]/70"
                      >
                        <td className="px-2 py-1.5">
                          <input
                            value={row.name}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMembersRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, name: v } : r,
                                ),
                              );
                            }}
                            placeholder="Name"
                            className="w-full min-w-[7rem] bg-[var(--input)] px-2 py-1.5 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.relation}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMembersRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, relation: v } : r,
                                ),
                              );
                            }}
                            placeholder="Partner, dog…"
                            className="w-full min-w-[6rem] bg-[var(--input)] px-2 py-1.5 text-sm outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={row.phone}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMembersRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, phone: v } : r,
                                ),
                              );
                            }}
                            placeholder="Optional"
                            className="w-full min-w-[7rem] bg-[var(--input)] px-2 py-1.5 font-mono text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="email"
                            value={row.email}
                            onChange={(e) => {
                              const v = e.target.value;
                              setMembersRows((prev) =>
                                prev.map((r, i) =>
                                  i === idx ? { ...r, email: v } : r,
                                ),
                              );
                            }}
                            placeholder="Optional"
                            className="w-full min-w-[10rem] bg-[var(--input)] px-2 py-1.5 font-mono text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
                          />
                        </td>
                        <td className="px-2.5 py-1.5 text-xs text-[var(--muted)]">
                          —
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-[var(--danger)]"
                            onClick={() => {
                              setMembersRows((prev) =>
                                prev.filter((_, i) => i !== idx),
                              );
                            }}
                          >
                            Remove
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setMembersRows((prev) => [
                  ...prev,
                  { name: "", relation: "", phone: "", email: "" },
                ]);
              }}
            >
              Add member
            </Button>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={membersSaving}
              onClick={() => {
                setMembersEditId(null);
                setMembersOwnerName("");
                setMembersOwnerPhone("");
                setMembersOwnerEmail("");
                setMembersLastLocation(null);
                setMembersRows([]);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!membersEditId || membersSaving}
              onClick={() => {
                if (!membersEditId) return;
                const members = membersRows
                  .map((r) => ({
                    name: r.name.trim(),
                    relation: r.relation.trim() || undefined,
                    phone: r.phone.trim() || undefined,
                    email: r.email.trim().toLowerCase() || undefined,
                  }))
                  .filter((r) => r.name);
                setMembersSaving(true);
                void updateHouseholdMembers(membersEditId, members)
                  .then(() => {
                    setMembersEditId(null);
                    setMembersOwnerName("");
                    setMembersOwnerPhone("");
                    setMembersOwnerEmail("");
                    setMembersLastLocation(null);
                    setMembersRows([]);
                  })
                  .catch((err) => {
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not save members",
                    );
                  })
                  .finally(() => setMembersSaving(false));
              }}
            >
              {membersSaving ? "Saving…" : "Save members"}
            </Button>
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
