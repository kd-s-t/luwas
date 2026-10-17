"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { CommandAreaMapMount } from "@/components/CommandAreaMapMount";
import { FadeIn } from "@/components/motion/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  addEvacCenter,
  ensureApasEvacCenters,
  ensureNangkaEvacCenters,
  subscribeEvacCenters,
  updateEvacCenter,
} from "@/lib/evacCenters/api";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_ORG_NAME,
} from "@/lib/evacCenters/apasSeed";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/evacCenters/nangkaSeed";
import {
  createEvacStockRequestReport,
  EVAC_REQUEST_RESOURCES,
  type EvacRequestResourceId,
  type EvacRequestUrgency,
} from "@/lib/evacCenters/requestReport";
import {
  EVAC_CENTER_CONDITIONS,
  emptyEvacStock,
  evacConditionLabel,
  formatEvacUpdatedAt,
  isEvacCenterUnusable,
  type EvacCenter,
  type EvacCenterCondition,
  type EvacCenterStock,
} from "@/lib/evacCenters/types";
import type { AssistEscapeRoute } from "@/lib/ai/assistTypes";
import { bearingDegrees, compassLabel, distKm } from "@/lib/geo/bearing";
import { estimateElevM } from "@/lib/geo/nangkaElevation";
import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
import { commandHallPoint, type SafePoint } from "@/lib/geo/safePoints";
import { useRoadEscapes } from "@/lib/geo/useRoadEscapes";
import {
  filterPlaces,
  placeLabel,
  type ServiceAreaPlace,
} from "@/lib/reports/serviceAreaPlaces";
import { cn } from "@/lib/utils";

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[220px] items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--muted)]">
      Loading map…
    </div>
  ),
});

function conditionBadgeClass(condition: EvacCenterCondition): string {
  switch (condition) {
    case "flooded":
      return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
    case "collapsed":
      return "bg-[#fef2f2] text-[#b91c1c] ring-[#fca5a5]/70";
    case "unusable":
      return "bg-[#fef2f2] text-[#991b1b] ring-[#fecaca]/80";
    default:
      return "bg-[#ecfdf3] text-[#16794c] ring-[#86efac]/60";
  }
}

function evacToSafePoint(row: EvacCenter): SafePoint {
  const school = /elementary|school|high school|academy/i.test(row.name);
  return {
    id: row.id,
    name: row.name,
    kind: school ? "school" : "evac_center",
    lat: row.lat,
    lng: row.lng,
    elevM: Math.round(estimateElevM(row.lat, row.lng)),
    isEvacCenter: true,
    condition: row.condition,
    occupancy: row.occupancy,
    capacity: row.maxCapacity,
    updatedAt: row.updatedAt,
    locationLabel: row.locationLabel || undefined,
    stock: { ...row.stock },
    notes: [
      isEvacCenterUnusable(row.condition)
        ? evacConditionLabel(row.condition)
        : null,
      row.open24h ? "Open 24 hours" : null,
      row.notes || null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function directionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

function routesFromHall(
  hall: SafePoint,
  centers: EvacCenter[],
): AssistEscapeRoute[] {
  return centers
    .filter((row) => !isEvacCenterUnusable(row.condition))
    .map((row) => {
      const to = { lat: row.lat, lng: row.lng };
      const from = { lat: hall.lat, lng: hall.lng };
      const bearing = bearingDegrees(from, to);
      const distanceKm = distKm(from, to);
      const direction = compassLabel(bearing);
      return {
        householdId: `hall-${row.id}`,
        from,
        to,
        destinationId: row.id,
        destinationName: row.name,
        bearing,
        direction,
        distanceKm,
        instruction: `${direction} · ${distanceKm.toFixed(1)} km from Brgy. Hall`,
        path: [from, to],
        routed: false,
      };
    });
}

function resolveBarangay(profile: ReturnType<typeof useAuth>["profile"]): {
  barangayId: string;
  orgName: string;
  lgu: string;
  mapArea: MapArea;
} {
  if (!isOfficer(profile)) {
    return {
      barangayId: NANGKA_BARANGAY_ID,
      orgName: NANGKA_ORG_NAME,
      lgu: "Consolacion",
      mapArea: DEFAULT_MAP_AREA,
    };
  }
  const areaId = (profile.areaId ?? profile.activeBarangayId)?.trim();
  if (areaId?.includes("apas")) {
    return {
      barangayId: APAS_BARANGAY_DOC_ID,
      orgName: profile.orgName || APAS_ORG_NAME,
      lgu: "Cebu City",
      mapArea: {
        ...DEFAULT_MAP_AREA,
        id: "cebu-city/apas",
        barangay: "Apas",
        lgu: "Cebu City",
        center: { lat: 10.337229, lng: 123.90484 },
      },
    };
  }
  return {
    barangayId: NANGKA_BARANGAY_ID,
    orgName: profile.orgName?.trim() || NANGKA_ORG_NAME,
    lgu: "Consolacion",
    mapArea: DEFAULT_MAP_AREA,
  };
}

type StockQtyKey = "foodPacks" | "waterLiters" | "blankets" | "medicalKits";

const STOCK_QTY_ROWS: { key: StockQtyKey; label: string; step: number }[] = [
  { key: "foodPacks", label: "Food packs", step: 1 },
  { key: "waterLiters", label: "Water (L)", step: 10 },
  { key: "blankets", label: "Blankets", step: 1 },
  { key: "medicalKits", label: "Medical kits", step: 1 },
];

function QtyStepper({
  label,
  value,
  step,
  max,
  suffix,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  step: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  function clamp(n: number) {
    let next = Math.max(0, Math.round(n));
    if (typeof max === "number") next = Math.min(max, next);
    return next;
  }

  function commitDraft() {
    const parsed = Number(draft);
    const next = clamp(Number.isFinite(parsed) ? parsed : value);
    setDraft(String(next));
    if (next !== value) onCommit(next);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2">
      <p className="text-[13px] font-medium text-[var(--foreground)]">{label}</p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled || value <= 0}
          onClick={() => onCommit(clamp(value - step))}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-base font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-40"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={draft}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
          }}
          className="w-14 rounded-lg border border-[var(--border)] bg-white px-1.5 py-1 text-center text-sm tabular-nums outline-none focus:border-[#3b6fb6]/50 disabled:opacity-50"
        />
        {suffix ? (
          <span className="min-w-[3.5rem] text-[12px] text-[var(--muted)]">
            {suffix}
          </span>
        ) : null}
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={
            disabled || (typeof max === "number" && value >= max)
          }
          onClick={() => onCommit(clamp(value + step))}
          className="flex size-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-base font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

function StockFields({
  stock,
  onChange,
}: {
  stock: EvacCenterStock;
  onChange: (next: EvacCenterStock) => void;
}) {
  function bump(key: StockQtyKey, delta: number) {
    onChange({
      ...stock,
      [key]: Math.max(0, stock[key] + delta),
    });
  }

  return (
    <div className="space-y-3">
      {STOCK_QTY_ROWS.map(({ key, label, step }) => (
        <div
          key={key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
        >
          <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={`Decrease ${label}`}
              disabled={stock[key] <= 0}
              onClick={() => bump(key, -step)}
              className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="number"
              min={0}
              value={stock[key]}
              onChange={(e) =>
                onChange({
                  ...stock,
                  [key]: Math.max(0, Number(e.target.value) || 0),
                })
              }
              className="w-16 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[#3b6fb6]/50"
            />
            <button
              type="button"
              aria-label={`Increase ${label}`}
              onClick={() => bump(key, step)}
              className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
            >
              +
            </button>
          </div>
        </div>
      ))}
      <label className="block space-y-1">
        <span className="text-[12px] font-medium text-[var(--muted)]">
          Other stock / notes
        </span>
        <input
          type="text"
          value={stock.other}
          onChange={(e) => onChange({ ...stock, other: e.target.value })}
          placeholder="Generators, mats, cooking gear…"
          className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b6fb6]/50"
        />
      </label>
    </div>
  );
}

export function EvacCentersPanel() {
  const { profile } = useAuth();
  const { barangayId, orgName, lgu, mapArea } = useMemo(
    () => resolveBarangay(profile),
    [profile],
  );

  const [rows, setRows] = useState<EvacCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [conditionBusyId, setConditionBusyId] = useState<string | null>(null);
  const [stockBusyId, setStockBusyId] = useState<string | null>(null);
  const [requestBusyId, setRequestBusyId] = useState<string | null>(null);
  const [requestCenter, setRequestCenter] = useState<EvacCenter | null>(null);
  const [requestSelected, setRequestSelected] = useState<
    Partial<Record<EvacRequestResourceId, number>>
  >({});
  const [requestUrgency, setRequestUrgency] =
    useState<EvacRequestUrgency>("urgent");
  const [requestDelivery, setRequestDelivery] = useState("");
  const [requestNotes, setRequestNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [placeSearch, setPlaceSearch] = useState("");
  const [lat, setLat] = useState(DEFAULT_MAP_AREA.center.lat);
  const [lng, setLng] = useState(DEFAULT_MAP_AREA.center.lng);
  const [pinZoom, setPinZoom] = useState(15);
  const [maxCapacity, setMaxCapacity] = useState("250");
  const [occupancy, setOccupancy] = useState("0");
  const [stock, setStock] = useState<EvacCenterStock>(emptyEvacStock());
  const [notes, setNotes] = useState("");
  const [open24h, setOpen24h] = useState(false);
  const [condition, setCondition] = useState<EvacCenterCondition>("usable");

  const seeded = useRef(false);
  const placeHits = useMemo(
    () => filterPlaces(placeSearch),
    [placeSearch],
  );

  const hallPoint = useMemo(() => commandHallPoint(mapArea), [mapArea]);
  const mapSafePoints = useMemo(
    () => [hallPoint, ...rows.map(evacToSafePoint)],
    [hallPoint, rows],
  );
  const crowDirections = useMemo(
    () => routesFromHall(hallPoint, rows),
    [hallPoint, rows],
  );
  const mapDirections = useRoadEscapes(crowDirections, { deferMs: 200 });

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeEvacCenters(
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
    const run =
      barangayId === APAS_BARANGAY_DOC_ID
        ? ensureApasEvacCenters()
        : barangayId === NANGKA_BARANGAY_ID
          ? ensureNangkaEvacCenters()
          : Promise.resolve();
    void run.catch(() => {
      seeded.current = false;
    });
  }, [profile, barangayId]);

  function resetForm() {
    setName("");
    setLocationLabel("");
    setPlaceSearch("");
    setLat(mapArea.center.lat);
    setLng(mapArea.center.lng);
    setPinZoom(15);
    setMaxCapacity("250");
    setOccupancy("0");
    setStock(emptyEvacStock());
    setNotes("");
    setOpen24h(false);
    setCondition("usable");
    setEditingId(null);
  }

  function pickPlace(p: ServiceAreaPlace) {
    setLat(p.lat);
    setLng(p.lng);
    setPinZoom(15);
    setPlaceSearch(placeLabel(p));
    if (!locationLabel.trim()) {
      setLocationLabel(placeLabel(p));
    }
  }

  function startEdit(row: EvacCenter) {
    setEditingId(row.id);
    setName(row.name);
    setLocationLabel(row.locationLabel);
    setPlaceSearch(row.locationLabel || row.name);
    setLat(row.lat);
    setLng(row.lng);
    setPinZoom(16);
    setMaxCapacity(String(row.maxCapacity));
    setOccupancy(String(row.occupancy));
    setStock({ ...row.stock });
    setNotes(row.notes ?? "");
    setOpen24h(row.open24h);
    setCondition(row.condition);
    setOpen(true);
    setMsg(null);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const cap = Number(maxCapacity);
      const people = Number(occupancy);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Pin the shelter on the map or pick a search result.");
      }
      if (!Number.isFinite(cap) || cap < 0) {
        throw new Error("Enter a valid max capacity.");
      }
      if (!Number.isFinite(people) || people < 0) {
        throw new Error("Enter a valid people count.");
      }
      const payload = {
        name,
        locationLabel:
          locationLabel.trim() || placeSearch.trim() || name.trim(),
        lat,
        lng,
        maxCapacity: cap,
        occupancy: people,
        condition,
        stock,
        notes: notes.trim() || undefined,
        open24h,
      };
      if (editingId) {
        await updateEvacCenter(editingId, payload);
        setMsg(`${name.trim()} updated.`);
      } else {
        await addEvacCenter(barangayId, orgName, lgu, payload);
        setMsg(`${name.trim()} added to the evac directory.`);
      }
      resetForm();
      setOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save evacuation center.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setRowCondition(
    row: EvacCenter,
    next: EvacCenterCondition,
  ) {
    if (conditionBusyId || row.condition === next) return;
    setConditionBusyId(row.id);
    setError(null);
    try {
      await updateEvacCenter(row.id, { condition: next });
      setMsg(`${row.name}: ${evacConditionLabel(next)}.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update site condition.",
      );
    } finally {
      setConditionBusyId(null);
    }
  }

  async function setRowOccupancy(row: EvacCenter, occupancy: number) {
    if (stockBusyId) return;
    const next = Math.max(
      0,
      Math.min(row.maxCapacity, Math.round(occupancy)),
    );
    if (next === row.occupancy) return;
    setStockBusyId(row.id);
    setError(null);
    try {
      await updateEvacCenter(row.id, { occupancy: next });
      setMsg(`${row.name}: ${next} / ${row.maxCapacity} people.`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update people count.",
      );
    } finally {
      setStockBusyId(null);
    }
  }

  async function setRowStockQty(
    row: EvacCenter,
    key: StockQtyKey,
    value: number,
  ) {
    if (stockBusyId) return;
    const next = Math.max(0, Math.round(value));
    if (next === row.stock[key]) return;
    setStockBusyId(row.id);
    setError(null);
    try {
      await updateEvacCenter(row.id, {
        stock: { ...row.stock, [key]: next },
      });
      setMsg(`${row.name}: stock updated.`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update stock.",
      );
    } finally {
      setStockBusyId(null);
    }
  }

  function openRequestForm(row: EvacCenter) {
    setRequestCenter(row);
    setRequestSelected({
      foodPacks: 100,
      waterLiters: 200,
      medicalKits: 10,
    });
    setRequestUrgency("urgent");
    setRequestDelivery(row.name);
    setRequestNotes("");
    setError(null);
  }

  function closeRequestForm() {
    if (requestBusyId) return;
    setRequestCenter(null);
  }

  function toggleRequestResource(id: EvacRequestResourceId) {
    setRequestSelected((prev) => {
      const next = { ...prev };
      if (next[id] != null) {
        delete next[id];
        return next;
      }
      const def =
        EVAC_REQUEST_RESOURCES.find((r) => r.id === id)?.defaultQty ?? 1;
      next[id] = def;
      return next;
    });
  }

  function setRequestQty(id: EvacRequestResourceId, qty: number) {
    const meta = EVAC_REQUEST_RESOURCES.find((r) => r.id === id);
    const step = meta?.step ?? 1;
    const clamped = Math.max(step, Math.round(qty / step) * step);
    setRequestSelected((prev) => ({ ...prev, [id]: clamped }));
  }

  async function submitRequestForm() {
    if (
      !requestCenter ||
      !isOfficer(profile) ||
      !isAccountActive(profile) ||
      requestBusyId
    ) {
      return;
    }
    const lines = EVAC_REQUEST_RESOURCES.filter(
      (r) => requestSelected[r.id] != null,
    ).map((r) => ({
      id: r.id,
      label: r.label,
      quantity: requestSelected[r.id]!,
      unit: r.unit,
    }));
    setRequestBusyId(requestCenter.id);
    setError(null);
    setMsg(null);
    try {
      const id = await createEvacStockRequestReport({
        author: profile,
        center: requestCenter,
        barangay: mapArea.barangay,
        lgu,
        lines,
        urgency: requestUrgency,
        deliveryLocation: requestDelivery,
        notes: requestNotes,
      });
      setMsg(`${requestCenter.name}: supply request ${id} filed.`);
      setRequestCenter(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create supply request.",
      );
    } finally {
      setRequestBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <FadeIn y={8}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Evac centers
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              Shelter directory for {orgName}: location, people on site, max
              capacity, and what is stored. Officers manage this list here
              instead of editing the database by hand.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setOpen(true);
            }}
            className="inline-flex items-center rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c]"
          >
            Add evac center
          </button>
        </div>
      </FadeIn>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) resetForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit evacuation center" : "New evacuation center"}
            </DialogTitle>
            <DialogDescription>
              Location, people on site, capacity, site condition, and on-site
              stock.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <DialogBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[12px] font-medium text-[var(--muted)]">
                    Name
                  </span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nangka Elementary School"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b6fb6]/50"
                  />
                </label>
                <label className="block space-y-1 sm:col-span-2">
                  <span className="text-[12px] font-medium text-[var(--muted)]">
                    Location / landmark
                  </span>
                  <input
                    value={locationLabel}
                    onChange={(e) => setLocationLabel(e.target.value)}
                    placeholder="Purok, street, or landmark"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b6fb6]/50"
                  />
                </label>
                <div className="space-y-2 sm:col-span-2">
                  <label className="block space-y-1">
                    <span className="text-[12px] font-medium text-[var(--muted)]">
                      Search location
                    </span>
                    <input
                      type="search"
                      value={placeSearch}
                      onChange={(e) => setPlaceSearch(e.target.value)}
                      placeholder="Nangka, SM Consolacion, school…"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b6fb6]/50"
                      autoComplete="off"
                    />
                  </label>
                  {placeHits.length > 0 ? (
                    <ul className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)] bg-white">
                      {placeHits.map((p) => {
                        const label = placeLabel(p);
                        const active =
                          Math.abs(p.lat - lat) < 1e-5 &&
                          Math.abs(p.lng - lng) < 1e-5;
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => pickPlace(p)}
                              className={cn(
                                "flex w-full px-3 py-2.5 text-left text-sm transition",
                                active
                                  ? "bg-[#eff6ff] text-[#1e40af]"
                                  : "text-[var(--foreground)] hover:bg-[var(--surface)]",
                              )}
                            >
                              {label}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                  <div className="space-y-1">
                    <p className="text-[12px] font-medium text-[var(--muted)]">
                      Pin on map
                    </p>
                    <HallPinMap
                      center={{ lat, lng }}
                      zoom={pinZoom}
                      className="relative h-[220px] w-full overflow-hidden rounded-xl border border-[var(--border)]"
                      onChange={({ center, zoom }) => {
                        setLat(center.lat);
                        setLng(center.lng);
                        setPinZoom(zoom);
                      }}
                    />
                    <p className="text-[11px] text-[var(--muted)]">
                      Search a place or tap the map to set the shelter pin.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    People on site
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease people on site"
                      disabled={Number(occupancy) <= 0}
                      onClick={() =>
                        setOccupancy(
                          String(Math.max(0, Number(occupancy) - 1)),
                        )
                      }
                      className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      required
                      type="number"
                      min={0}
                      value={occupancy}
                      onChange={(e) => setOccupancy(e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[#3b6fb6]/50"
                    />
                    <button
                      type="button"
                      aria-label="Increase people on site"
                      onClick={() =>
                        setOccupancy(
                          String(Math.max(0, Number(occupancy) + 1)),
                        )
                      }
                      className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    Max capacity
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease capacity"
                      disabled={Number(maxCapacity) <= 0}
                      onClick={() =>
                        setMaxCapacity(
                          String(Math.max(0, Number(maxCapacity) - 10)),
                        )
                      }
                      className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      required
                      type="number"
                      min={0}
                      value={maxCapacity}
                      onChange={(e) => setMaxCapacity(e.target.value)}
                      className="w-20 rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-center text-sm tabular-nums outline-none focus:border-[#3b6fb6]/50"
                    />
                    <button
                      type="button"
                      aria-label="Increase capacity"
                      onClick={() =>
                        setMaxCapacity(
                          String(Math.max(0, Number(maxCapacity) + 10)),
                        )
                      }
                      className="flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-lg font-semibold text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
                    >
                      +
                    </button>
                  </div>
                </div>
                <label className="flex items-end gap-2 pb-2 text-sm text-[var(--foreground)] sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={open24h}
                    onChange={(e) => setOpen24h(e.target.checked)}
                    className="size-4 rounded border-[var(--border)]"
                  />
                  Open 24 hours
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-[12px] font-medium text-[var(--muted)]">
                  Site condition
                </p>
                <div className="flex flex-wrap gap-2">
                  {EVAC_CENTER_CONDITIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCondition(opt.id)}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm font-medium transition",
                        condition === opt.id
                          ? opt.id === "usable"
                            ? "border-[#16794c]/40 bg-[#ecfdf3] text-[#16794c]"
                            : "border-[#c2410c]/40 bg-[#fff7ed] text-[#9a3412]"
                          : "border-[var(--border)] bg-white text-[var(--foreground)] hover:border-[var(--foreground)]/25",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[12px] font-medium text-[var(--muted)]">
                  What is stored in this evac
                </p>
                <StockFields stock={stock} onChange={setStock} />
              </div>

              <label className="block space-y-1">
                <span className="text-[12px] font-medium text-[var(--muted)]">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
            </DialogBody>
            <DialogFooter className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c] disabled:opacity-50"
              >
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Add center"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[#16794c]" role="status">
          {msg}
        </p>
      ) : null}

      <FadeIn y={8}>
        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                Map
              </h2>
              <p className="text-[12px] text-[var(--muted)]">
                Brgy. Hall + {rows.length} center
                {rows.length === 1 ? "" : "s"} · road routes to usable shelters
              </p>
            </div>
          </div>
          <div className="relative h-[min(22rem,55vh)] min-h-[16rem] w-full overflow-hidden bg-[var(--surface)]">
            <CommandAreaMapMount
              area={mapArea}
              lockCameraToArea
              households={[]}
              quakes={[]}
              landslides={[]}
              floods={[]}
              typhoons={[]}
              fires={[]}
              reportPins={[]}
              safePoints={mapSafePoints}
              responders={[]}
              assistPriorities={{}}
              escapeRoutes={mapDirections}
              scrollWheelZoom
              pulseFacilities
            />
          </div>
        </section>
      </FadeIn>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Directory
          </h2>
          <p className="text-[12px] text-[var(--muted)]">
            {loading
              ? "Loading…"
              : `${rows.length} active center${rows.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="px-4 py-10 text-center text-sm text-[var(--muted)] sm:px-5">
            No evacuation centers yet. Add one to start the directory.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-[var(--foreground)]">
                      {row.name}
                    </p>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
                        conditionBadgeClass(row.condition),
                      )}
                    >
                      {evacConditionLabel(row.condition)}
                    </span>
                    {row.open24h ? (
                      <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-semibold text-[#16794c] ring-1 ring-[#86efac]/60">
                        24h
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {row.locationLabel || "No landmark label"}
                  </p>
                  {formatEvacUpdatedAt(row.updatedAt) ? (
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      Last updated {formatEvacUpdatedAt(row.updatedAt)}
                    </p>
                  ) : null}
                  <div className="mt-2 max-w-md space-y-1.5">
                    <p className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">
                      On site · quick update
                    </p>
                    <QtyStepper
                      label="People"
                      value={row.occupancy}
                      step={1}
                      max={row.maxCapacity}
                      suffix={`/ ${row.maxCapacity}`}
                      disabled={stockBusyId === row.id}
                      onCommit={(next) => void setRowOccupancy(row, next)}
                    />
                    {STOCK_QTY_ROWS.map(({ key, label, step }) => (
                      <QtyStepper
                        key={key}
                        label={label}
                        value={row.stock[key]}
                        step={step}
                        disabled={stockBusyId === row.id}
                        onCommit={(next) =>
                          void setRowStockQty(row, key, next)
                        }
                      />
                    ))}
                  </div>
                  {row.notes ? (
                    <p className="mt-1 text-[12px] text-[var(--muted)]">
                      {row.notes}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {EVAC_CENTER_CONDITIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={conditionBusyId === row.id}
                        onClick={() => void setRowCondition(row, opt.id)}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition disabled:opacity-50",
                          row.condition === opt.id
                            ? opt.id === "usable"
                              ? "border-[#16794c]/40 bg-[#ecfdf3] text-[#16794c]"
                              : "border-[#c2410c]/40 bg-[#fff7ed] text-[#9a3412]"
                            : "border-[var(--border)] bg-white text-[var(--muted)] hover:border-[var(--foreground)]/20 hover:text-[var(--foreground)]",
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 sm:items-end">
                  <button
                    type="button"
                    disabled={requestBusyId === row.id}
                    onClick={() => openRequestForm(row)}
                    className="rounded-xl border border-[var(--foreground)] bg-[var(--foreground)] px-3 py-2 text-center text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Request resources
                  </button>
                  <a
                    href={directionsUrl(hallPoint, {
                      lat: row.lat,
                      lng: row.lng,
                    })}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-center text-sm font-medium text-[#2f5f9e] transition hover:border-[#2f5f9e]/40"
                  >
                    Directions
                  </a>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    className={cn(
                      "rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25",
                    )}
                  >
                    Edit
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={Boolean(requestCenter)}
        onOpenChange={(open) => {
          if (!open) closeRequestForm();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create resource request</DialogTitle>
            <DialogDescription>
              {requestCenter?.name ?? "Evacuation center"}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                What resources are needed?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {EVAC_REQUEST_RESOURCES.map((res) => {
                  const selected = requestSelected[res.id] != null;
                  const qty = requestSelected[res.id] ?? res.defaultQty;
                  return (
                    <div
                      key={res.id}
                      className={cn(
                        "flex flex-col rounded-xl border p-3 transition",
                        selected
                          ? "border-[var(--foreground)]/40 bg-[var(--surface)]"
                          : "border-[var(--border)] bg-white",
                      )}
                    >
                      <label className="flex cursor-pointer items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug text-[var(--foreground)]">
                          {res.label}
                        </span>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleRequestResource(res.id)}
                          className="mt-0.5 size-4 shrink-0 accent-[var(--foreground)]"
                        />
                      </label>
                      {selected ? (
                        <div className="mt-3 flex items-center gap-1.5">
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium"
                            onClick={() =>
                              setRequestQty(res.id, qty - res.step)
                            }
                            aria-label={`Decrease ${res.label}`}
                          >
                            −
                          </button>
                          <p className="min-w-0 flex-1 text-center text-xs tabular-nums text-[var(--muted)]">
                            <span className="font-semibold text-[var(--foreground)]">
                              {qty}
                            </span>{" "}
                            {res.unit}
                          </p>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-sm font-medium"
                            onClick={() =>
                              setRequestQty(res.id, qty + res.step)
                            }
                            aria-label={`Increase ${res.label}`}
                          >
                            +
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Urgency level
              </p>
              <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-panel)]/40 p-1">
                {(
                  [
                    ["normal", "Normal"],
                    ["urgent", "Urgent"],
                    ["critical", "Critical"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setRequestUrgency(id)}
                    className={cn(
                      "rounded-lg px-2 py-2 text-sm font-medium transition",
                      requestUrgency === id
                        ? "bg-[var(--foreground)] text-white"
                        : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Delivery location
              </span>
              <input
                value={requestDelivery}
                onChange={(e) => setRequestDelivery(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--foreground)]/30"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-semibold text-[var(--foreground)]">
                Additional notes
              </span>
              <div className="relative">
                <textarea
                  value={requestNotes}
                  maxLength={500}
                  rows={3}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Add details for the response team (optional)"
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 pr-14 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--foreground)]/30"
                />
                <span className="pointer-events-none absolute right-3 bottom-2.5 text-[10px] tabular-nums text-[var(--muted)]">
                  {requestNotes.length}/500
                </span>
              </div>
            </label>
          </DialogBody>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <button
              type="button"
              disabled={Boolean(requestBusyId)}
              onClick={closeRequestForm}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={
                Boolean(requestBusyId) ||
                Object.keys(requestSelected).length === 0
              }
              onClick={() => void submitRequestForm()}
              className="rounded-xl border border-[var(--foreground)] bg-[var(--foreground)] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {requestBusyId ? "Submitting…" : "Submit request"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
