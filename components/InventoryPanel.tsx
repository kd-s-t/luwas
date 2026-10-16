"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  addBarangayInventoryItem,
  dispatchBarangayInventoryItem,
  ensureActiveBarangayInventory,
  returnBarangayInventoryItem,
  subscribeBarangayInventory,
  updateBarangayInventoryQty,
} from "@/lib/inventory/api";
import { ACTIVE_INVENTORY_BARANGAYS } from "@/lib/inventory/activeBarangays";
import { INVENTORY_STATE_EXAMPLES } from "@/lib/inventory/seed";
import {
  formatInventoryDispatchWhen,
  inventoryCategoryLabel,
  inventoryDispatchStatusLabel,
  inventoryHistoryKindLabel,
  netDispatchedQty,
  openDispatchReportIds,
  type InventoryCategory,
  type InventoryItem,
} from "@/lib/inventory/types";
import { getHazardReportById } from "@/lib/reports/api";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/staff/nangkaStaff";
import { cn } from "@/lib/utils";

type TicketMeta = { id: string; title: string };

const CATEGORY_OPTIONS: InventoryCategory[] = [
  "vehicle",
  "generator",
  "supply",
  "equipment",
  "other",
];

function resolveBarangay(profile: ReturnType<typeof useAuth>["profile"]): {
  barangayId: string;
  orgName: string;
} {
  if (!isOfficer(profile)) {
    return { barangayId: NANGKA_BARANGAY_ID, orgName: NANGKA_ORG_NAME };
  }
  const areaId = (profile.areaId ?? profile.activeBarangayId)?.trim() ?? "";
  if (areaId.includes("apas")) {
    const hit = ACTIVE_INVENTORY_BARANGAYS.find(
      (b) => b.barangayId === APAS_BARANGAY_DOC_ID,
    );
    return {
      barangayId: APAS_BARANGAY_DOC_ID,
      orgName: profile.orgName || hit?.orgName || "Apas · Cebu City",
    };
  }
  const nangka = ACTIVE_INVENTORY_BARANGAYS.find(
    (b) => b.barangayId === NANGKA_BARANGAY_ID,
  );
  return {
    barangayId: NANGKA_BARANGAY_ID,
    orgName: profile.orgName?.trim() || nangka?.orgName || NANGKA_ORG_NAME,
  };
}

export function InventoryPanel() {
  const { profile } = useAuth();
  const { barangayId, orgName } = useMemo(
    () => resolveBarangay(profile),
    [profile],
  );

  const [rows, setRows] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState<Record<string, boolean>>(
    {},
  );
  const [tickets, setTickets] = useState<Record<string, TicketMeta>>({});

  const [label, setLabel] = useState("");
  const [category, setCategory] = useState<InventoryCategory>("supply");
  const [unit, setUnit] = useState("units");
  const [available, setAvailable] = useState("0");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");

  const seeded = useRef(false);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeBarangayInventory(
      barangayId,
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
  }, [profile, barangayId]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    if (seeded.current) return;
    seeded.current = true;
    void ensureActiveBarangayInventory()
      .catch(() => {
        seeded.current = false;
      });
  }, [profile]);

  const linkedReportIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.lastDispatch?.reportId) ids.add(row.lastDispatch.reportId);
      for (const h of row.history) {
        if (h.reportId) ids.add(h.reportId);
      }
    }
    return [...ids];
  }, [rows]);

  useEffect(() => {
    if (linkedReportIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, TicketMeta> = {};
      await Promise.all(
        linkedReportIds.map(async (id) => {
          try {
            const report = await getHazardReportById(id);
            if (report) {
              next[id] = {
                id: report.id,
                title: report.title?.trim() || report.id,
              };
            }
          } catch {
            /* ignore missing ticket */
          }
        }),
      );
      if (!cancelled) {
        setTickets((prev) => ({ ...prev, ...next }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [linkedReportIds]);

  function ticketLink(reportId: string) {
    const meta = tickets[reportId];
    return (
      <p className="text-[12px]">
        <span className="text-[var(--muted)]">Incident ticket · </span>
        <Link
          href={`/admin/incidents/${encodeURIComponent(reportId)}`}
          className="font-medium text-[var(--accent)] underline-offset-2 hover:underline"
        >
          {meta?.title ?? reportId}
        </Link>
        {meta ? (
          <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">
            {reportId}
          </span>
        ) : null}
      </p>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const qty = Number(available);
      await addBarangayInventoryItem(barangayId, orgName, {
        label,
        category,
        unit,
        available: qty,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setMsg(`${label.trim()} added to barangay inventory.`);
      setLabel("");
      setCategory("supply");
      setUnit("units");
      setAvailable("0");
      setLocation("");
      setNotes("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add item.");
    } finally {
      setBusy(false);
    }
  }

  async function bumpQty(item: InventoryItem, next: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateBarangayInventoryQty(item.id, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update qty.");
    } finally {
      setBusy(false);
    }
  }

  async function onDispatch(item: InventoryItem) {
    if (busy || !isOfficer(profile)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await dispatchBarangayInventoryItem({
        id: item.id,
        qty: 1,
        byUid: profile.uid,
        byName: profile.displayName?.trim() || profile.email || "Officer",
      });
      setMsg(`Dispatched 1 ${item.unit} of ${item.label}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dispatch.");
    } finally {
      setBusy(false);
    }
  }

  async function onReturn(item: InventoryItem) {
    if (busy || !isOfficer(profile)) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await returnBarangayInventoryItem({
        id: item.id,
        byUid: profile.uid,
        byName: profile.displayName?.trim() || profile.email || "Officer",
      });
      setMsg(`${item.label} marked returned to stock.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not return item.");
    } finally {
      setBusy(false);
    }
  }

  const byCategory = useMemo(() => {
    const map = new Map<InventoryCategory, InventoryItem[]>();
    for (const row of rows) {
      const list = map.get(row.category) ?? [];
      list.push(row);
      map.set(row.category, list);
    }
    return CATEGORY_OPTIONS.map((c) => ({
      category: c,
      items: map.get(c) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [rows]);

  return (
    <div className="space-y-4">
      <FadeIn y={8}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Inventory
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Barangay-owned stock for disasters: vehicles, generators, supplies.
              Officers update quantities here.
            </p>
            <p className="mt-1 text-[12px] text-[var(--muted)]">{orgName}</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c]"
          >
            {open ? "Close form" : "Add item"}
          </button>
        </div>
      </FadeIn>

      <div className="rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5">
        <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
          Status examples
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {INVENTORY_STATE_EXAMPLES.map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2"
            >
              <span
                className={cn(
                  "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                  s.tone === "out"
                    ? "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70"
                    : s.tone === "warn"
                      ? "bg-[#fffbeb] text-[#b45309] ring-[#fcd34d]/70"
                      : "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60",
                )}
              >
                {s.label}
              </span>
              <p className="mt-1.5 text-[12px] text-[var(--muted)]">{s.detail}</p>
            </li>
          ))}
        </ul>
      </div>

      {msg ? (
        <p className="rounded-xl border border-[#86efac]/60 bg-[#ecfdf3] px-3 py-2 text-sm text-[#16794c]">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-3 py-2 text-sm text-[#c72929]">
          {error}
        </p>
      ) : null}

      {open ? (
        <FadeIn y={6}>
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
          >
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              New inventory item
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Item name
                </span>
                <input
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Rescue boat"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Category
                </span>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as InventoryCategory)
                  }
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {inventoryCategoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Unit
                </span>
                <input
                  required
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="units · packs · L"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Quantity on hand
                </span>
                <input
                  required
                  type="number"
                  min={0}
                  step={1}
                  value={available}
                  onChange={(e) => setAvailable(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Location
                </span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Hall garage · Relief store"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Confirm crew before deploy."
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c] disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save item"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            On hand
          </h2>
          <span className="text-[12px] text-[var(--muted)]">
            {loading ? "Loading…" : `${rows.length} items`}
          </span>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5">
            No inventory yet. Add vehicles, generators, or relief stock for this
            barangay.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {byCategory.map((group) => (
              <div key={group.category}>
                <p className="border-b border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase sm:px-5">
                  {inventoryCategoryLabel(group.category)}
                </p>
                <ul className="divide-y divide-[var(--border)]">
                  {group.items.map((item) => (
                    <li key={item.id} className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 gap-3">
                          <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] sm:h-20 sm:w-28">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.label}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center px-1 text-center font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                                No photo
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-[var(--foreground)]">
                                {item.label}
                              </p>
                              <span
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                                  item.dispatchStatus === "dispatched"
                                    ? "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70"
                                    : "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60",
                                )}
                              >
                                {inventoryDispatchStatusLabel(
                                  item.dispatchStatus,
                                )}
                              </span>
                              {item.dispatchStatus === "on_hand" &&
                              item.available <= 0 ? (
                                <span className="rounded-full bg-[#fffbeb] px-2 py-0.5 text-[10px] font-semibold text-[#b45309] ring-1 ring-[#fcd34d]/70">
                                  Short
                                </span>
                              ) : null}
                              {item.dispatchStatus === "on_hand" &&
                              item.history.some((h) => h.kind === "return") ? (
                                <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8] ring-1 ring-[#93c5fd]/70">
                                  Returned
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1.5 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                              Location
                            </p>
                            <p className="text-sm font-medium text-[var(--foreground)]">
                              {item.location?.trim() || "Location TBD"}
                            </p>
                            {item.notes ? (
                              <p className="mt-1 text-[12px] text-[var(--muted)]">
                                {item.notes}
                              </p>
                            ) : null}
                            {(() => {
                              const outQty = netDispatchedQty(item.history);
                              const openTickets = openDispatchReportIds(
                                item.history,
                              );
                              if (outQty <= 0 && !item.lastDispatch) return null;
                              return (
                                <div className="mt-2 space-y-1.5">
                                  {outQty > 0 ? (
                                    <p className="text-[12px] font-medium text-[var(--foreground)]">
                                      {item.available} {item.unit} on hand ·{" "}
                                      {outQty} {item.unit} out · fleet{" "}
                                      {item.available + outQty}
                                    </p>
                                  ) : item.lastDispatch ? (
                                    <p className="text-[12px] text-[var(--foreground)]">
                                      Latest: {item.lastDispatch.qty}{" "}
                                      {item.unit} by {item.lastDispatch.byName}{" "}
                                      ·{" "}
                                      {formatInventoryDispatchWhen(
                                        item.lastDispatch.at,
                                      )}
                                    </p>
                                  ) : null}
                                  {openTickets.length > 0 ? (
                                    <div className="space-y-1">
                                      <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                                        Out on incident tickets
                                      </p>
                                      {openTickets.map((id) => (
                                        <div key={id}>{ticketLink(id)}</div>
                                      ))}
                                    </div>
                                  ) : item.lastDispatch?.reportId ? (
                                    ticketLink(item.lastDispatch.reportId)
                                  ) : null}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busy || item.available <= 0}
                              onClick={() =>
                                void bumpQty(
                                  item,
                                  Math.max(0, item.available - 1),
                                )
                              }
                              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-sm disabled:opacity-40"
                            >
                              −
                            </button>
                            <p
                              className={cn(
                                "min-w-[4.5rem] text-center font-mono text-sm tabular-nums",
                                item.available === 0
                                  ? "text-[var(--warn)]"
                                  : "text-[var(--foreground)]",
                              )}
                            >
                              {item.available} {item.unit}
                            </p>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void bumpQty(item, item.available + 1)
                              }
                              className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-sm disabled:opacity-40"
                            >
                              +
                            </button>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {item.available <= 0 ? (
                              <button
                                type="button"
                                disabled={busy}
                                title="Add stock before dispatch"
                                onClick={() =>
                                  void bumpQty(item, item.available + 1)
                                }
                                className="rounded-lg border border-[#2f5f9e] bg-[#2f5f9e] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#244a7c] disabled:opacity-40"
                              >
                                Add stock
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void onDispatch(item)}
                                className="rounded-lg border border-[#2f5f9e] bg-[#2f5f9e] px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-[#244a7c] disabled:opacity-40"
                              >
                                Dispatch
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={
                                busy || item.dispatchStatus !== "dispatched"
                              }
                              title={
                                item.dispatchStatus !== "dispatched"
                                  ? "Available after a dispatch"
                                  : "Mark returned to stock"
                              }
                              onClick={() => void onReturn(item)}
                              className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-medium text-[var(--foreground)] disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Return
                            </button>
                          </div>
                        </div>
                      </div>
                      {item.history.length > 0 ? (
                        <div className="mt-3 border-t border-[var(--border)] pt-3">
                          <button
                            type="button"
                            onClick={() =>
                              setTimelineOpen((prev) => ({
                                ...prev,
                                [item.id]: !prev[item.id],
                              }))
                            }
                            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--foreground)]"
                          >
                            {timelineOpen[item.id] ? "Hide" : "Show"} history ·{" "}
                            {item.history.length}
                          </button>
                          {timelineOpen[item.id] ? (
                            <ol className="relative mt-3 space-y-0 border-l border-[var(--border)] pl-4">
                              {item.history.map((event) => (
                                <li key={event.id} className="relative pb-3 last:pb-0">
                                  <span
                                    className={cn(
                                      "absolute -left-[1.15rem] top-1.5 size-2 rounded-full ring-2 ring-white",
                                      event.kind === "dispatch"
                                        ? "bg-[#c2410c]"
                                        : "bg-[#16794c]",
                                    )}
                                  />
                                  <p className="text-[12px] font-medium text-[var(--foreground)]">
                                    {inventoryHistoryKindLabel(event.kind)}{" "}
                                    {event.qty} {item.unit}
                                  </p>
                                  <p className="text-[11px] text-[var(--muted)]">
                                    by {event.byName} ·{" "}
                                    {formatInventoryDispatchWhen(event.at)}
                                    {event.note ? ` · ${event.note}` : ""}
                                  </p>
                                  {event.reportId ? (
                                    <div className="mt-0.5">
                                      {ticketLink(event.reportId)}
                                    </div>
                                  ) : null}
                                </li>
                              ))}
                            </ol>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
