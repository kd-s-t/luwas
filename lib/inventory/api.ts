import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { ACTIVE_INVENTORY_BARANGAYS } from "@/lib/inventory/activeBarangays";
import {
  INVENTORY_DEMO_STATE_VERSION,
  INVENTORY_SEEDS_BY_BARANGAY,
} from "@/lib/inventory/seed";
import type {
  InventoryCategory,
  InventoryDispatch,
  InventoryDispatchStatus,
  InventoryHistoryEvent,
  InventoryItem,
  InventoryItemInput,
} from "@/lib/inventory/types";
import { INVENTORY_HISTORY_CAP } from "@/lib/inventory/types";
import { NANGKA_BARANGAY_ID, NANGKA_ORG_NAME } from "@/lib/staff/nangkaStaff";

const COL = "barangayInventory";

function asIso(value: unknown, serverValue: unknown): string {
  if (typeof value === "string") return value;
  if (
    serverValue &&
    typeof serverValue === "object" &&
    "toDate" in serverValue &&
    typeof (serverValue as { toDate: () => Date }).toDate === "function"
  ) {
    return (serverValue as { toDate: () => Date }).toDate().toISOString();
  }
  return "";
}

function asCategory(raw: unknown): InventoryCategory {
  const v = String(raw ?? "other");
  if (
    v === "vehicle" ||
    v === "generator" ||
    v === "supply" ||
    v === "equipment"
  ) {
    return v;
  }
  return "other";
}

function mapDispatch(raw: unknown): InventoryDispatch | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const byUid = String(d.byUid ?? "").trim();
  const byName = String(d.byName ?? "").trim();
  const at = String(d.at ?? "").trim();
  const qty = Number(d.qty);
  if (!byUid || !byName || !at || !Number.isFinite(qty) || qty <= 0) return null;
  const reportId =
    typeof d.reportId === "string" && d.reportId.trim()
      ? d.reportId.trim()
      : undefined;
  return {
    qty,
    byUid,
    byName,
    at,
    note: typeof d.note === "string" && d.note.trim() ? d.note.trim() : undefined,
    reportId,
  };
}

function mapHistoryEvent(raw: unknown): InventoryHistoryEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Record<string, unknown>;
  const kind = d.kind === "return" ? "return" : d.kind === "dispatch" ? "dispatch" : null;
  const byUid = String(d.byUid ?? "").trim();
  const byName = String(d.byName ?? "").trim();
  const at = String(d.at ?? "").trim();
  const qty = Number(d.qty);
  const id = String(d.id ?? "").trim() || `${at}-${byUid}-${qty}`;
  if (!kind || !byUid || !byName || !at || !Number.isFinite(qty) || qty <= 0) {
    return null;
  }
  const reportId =
    typeof d.reportId === "string" && d.reportId.trim()
      ? d.reportId.trim()
      : undefined;
  return {
    id,
    kind,
    qty,
    byUid,
    byName,
    at,
    note: typeof d.note === "string" && d.note.trim() ? d.note.trim() : undefined,
    reportId,
  };
}

function mapHistory(raw: unknown, lastDispatch: InventoryDispatch | null): InventoryHistoryEvent[] {
  const fromArray = Array.isArray(raw)
    ? raw.map(mapHistoryEvent).filter((e): e is InventoryHistoryEvent => Boolean(e))
    : [];
  if (fromArray.length > 0) {
    return fromArray.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }
  // Backfill timeline from legacy lastDispatch only.
  if (!lastDispatch) return [];
  return [
    {
      id: `legacy-${lastDispatch.at}`,
      kind: "dispatch",
      qty: lastDispatch.qty,
      byUid: lastDispatch.byUid,
      byName: lastDispatch.byName,
      at: lastDispatch.at,
      note: lastDispatch.note,
      reportId: lastDispatch.reportId,
    },
  ];
}

function prependHistory(
  existing: unknown,
  event: InventoryHistoryEvent,
): InventoryHistoryEvent[] {
  const prev = mapHistory(existing, null);
  return [event, ...prev].slice(0, INVENTORY_HISTORY_CAP);
}

function mapDoc(id: string, data: Record<string, unknown>): InventoryItem {
  const available = Number(data.available);
  const dispatchStatus: InventoryDispatchStatus =
    data.dispatchStatus === "dispatched" ? "dispatched" : "on_hand";
  const lastDispatch = mapDispatch(data.lastDispatch);
  const history = mapHistory(data.history, lastDispatch);
  const latestDispatch =
    history.find((e) => e.kind === "dispatch") ?? null;
  const derivedLast: InventoryDispatch | null = latestDispatch
    ? {
        qty: latestDispatch.qty,
        byUid: latestDispatch.byUid,
        byName: latestDispatch.byName,
        at: latestDispatch.at,
        note: latestDispatch.note,
        reportId: latestDispatch.reportId,
      }
    : lastDispatch;
  return {
    id,
    label: String(data.label ?? ""),
    category: asCategory(data.category),
    unit: String(data.unit ?? "units"),
    available: Number.isFinite(available) ? Math.max(0, available) : 0,
    imageUrl:
      typeof data.imageUrl === "string" && data.imageUrl.trim()
        ? data.imageUrl.trim()
        : undefined,
    location: typeof data.location === "string" ? data.location : undefined,
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status: data.status === "inactive" ? "inactive" : "active",
    dispatchStatus,
    history,
    lastDispatch: derivedLast,
    barangayId: String(data.barangayId ?? NANGKA_BARANGAY_ID),
    orgName: String(data.orgName ?? NANGKA_ORG_NAME),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

function seedDocId(barangayId: string, seedId: string): string {
  return `${barangayId}__${seedId}`;
}

export function subscribeBarangayInventory(
  barangayId: string,
  onData: (rows: InventoryItem[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), COL),
    where("barangayId", "==", barangayId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs
        .map((d) => mapDoc(d.id, d.data() as Record<string, unknown>))
        .filter((r) => r.status === "active")
        .sort((a, b) => {
          const c = a.category.localeCompare(b.category);
          if (c !== 0) return c;
          return a.label.localeCompare(b.label);
        });
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addBarangayInventoryItem(
  barangayId: string,
  orgName: string,
  input: InventoryItemInput,
): Promise<string> {
  const label = input.label.trim();
  if (!label) throw new Error("Item name is required.");
  const available = Number(input.available);
  if (!Number.isFinite(available) || available < 0) {
    throw new Error("Quantity must be zero or more.");
  }
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getClientDb(), COL), {
    label,
    category: input.category,
    unit: input.unit.trim() || "units",
    available,
    imageUrl: input.imageUrl?.trim() || null,
    location: input.location?.trim() || null,
    notes: input.notes?.trim() || null,
    status: input.status ?? "active",
    dispatchStatus: "on_hand",
    lastDispatch: null,
    history: [],
    barangayId,
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return ref.id;
}

export async function updateBarangayInventoryQty(
  id: string,
  available: number,
): Promise<void> {
  if (!Number.isFinite(available) || available < 0) {
    throw new Error("Quantity must be zero or more.");
  }
  const now = new Date().toISOString();
  await setDoc(
    doc(getClientDb(), COL, id),
    {
      available,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Dispatch qty from stock; records officer + timestamp. */
export async function dispatchBarangayInventoryItem(input: {
  id: string;
  qty?: number;
  byUid: string;
  byName: string;
  note?: string;
  reportId?: string;
}): Promise<void> {
  const qty = input.qty ?? 1;
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Dispatch quantity must be at least 1.");
  }
  const byUid = input.byUid.trim();
  const byName = input.byName.trim();
  if (!byUid || !byName) throw new Error("Officer required to dispatch.");

  const ref = doc(getClientDb(), COL, input.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Inventory item not found.");
  const data = snap.data() as Record<string, unknown>;
  const available = Number(data.available);
  const onHand = Number.isFinite(available) ? Math.max(0, available) : 0;
  if (onHand < qty) throw new Error("Not enough stock on hand.");

  const now = new Date().toISOString();
  const note = input.note?.trim() || undefined;
  const reportId = input.reportId?.trim() || undefined;
  const event: InventoryHistoryEvent = {
    id: `dispatch-${now}-${byUid}`,
    kind: "dispatch",
    qty,
    byUid,
    byName,
    at: now,
    note,
    reportId,
  };
  const lastDispatch: InventoryDispatch = {
    qty,
    byUid,
    byName,
    at: now,
    note,
    reportId,
  };
  const remaining = onHand - qty;
  await setDoc(
    ref,
    {
      available: remaining,
      // Stay "dispatched" while any units are still out (remaining can be > 0).
      dispatchStatus: "dispatched",
      lastDispatch,
      history: prependHistory(data.history, event),
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Mark returned to stock; appends return to history timeline. */
export async function returnBarangayInventoryItem(input: {
  id: string;
  qty?: number;
  byUid: string;
  byName: string;
  note?: string;
}): Promise<void> {
  const byUid = input.byUid.trim();
  const byName = input.byName.trim();
  if (!byUid || !byName) throw new Error("Officer required to return stock.");

  const ref = doc(getClientDb(), COL, input.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Inventory item not found.");
  const data = snap.data() as Record<string, unknown>;
  const available = Number(data.available);
  const onHand = Number.isFinite(available) ? Math.max(0, available) : 0;
  const last = mapDispatch(data.lastDispatch);
  const qty = input.qty ?? last?.qty ?? 1;
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error("Return quantity must be at least 1.");
  }

  const now = new Date().toISOString();
  const note = input.note?.trim() || undefined;
  const event: InventoryHistoryEvent = {
    id: `return-${now}-${byUid}`,
    kind: "return",
    qty,
    byUid,
    byName,
    at: now,
    note,
  };
  await setDoc(
    ref,
    {
      available: onHand + qty,
      dispatchStatus: "on_hand",
      history: prependHistory(data.history, event),
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    },
    { merge: true },
  );
}

/** Idempotent seed for every active barangay inventory. */
export async function ensureActiveBarangayInventory(): Promise<number> {
  // Ensure linked incident tickets exist before inventory demos reference them.
  await Promise.all([
    import("@/lib/reports/ensureResourceShortageReport").then((m) =>
      m.ensureResourceShortageReport(),
    ),
    import("@/lib/reports/ensureQueueSampleReports").then((m) =>
      m.ensureQueueSampleReports(),
    ),
  ]).catch(() => {});

  const db = getClientDb();
  let written = 0;
  const now = new Date().toISOString();

  for (const brgy of ACTIVE_INVENTORY_BARANGAYS) {
    const seeds = INVENTORY_SEEDS_BY_BARANGAY[brgy.barangayId] ?? [];
    for (const seed of seeds) {
      const id = seedDocId(brgy.barangayId, seed.id);
      const ref = doc(db, COL, id);
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const data = existing.data() as {
          imageUrl?: unknown;
          location?: unknown;
          demoStateVersion?: unknown;
        };
        const patch: Record<string, unknown> = {};
        if (
          seed.imageUrl &&
          (typeof data.imageUrl !== "string" || !data.imageUrl.trim())
        ) {
          patch.imageUrl = seed.imageUrl;
        }
        if (
          seed.location &&
          (typeof data.location !== "string" || !data.location.trim())
        ) {
          patch.location = seed.location;
        }
        if (data.demoStateVersion !== INVENTORY_DEMO_STATE_VERSION) {
          patch.available = seed.available;
          patch.dispatchStatus = seed.dispatchStatus ?? "on_hand";
          patch.lastDispatch = seed.lastDispatch ?? null;
          patch.history = seed.history ?? [];
          patch.demoStateVersion = INVENTORY_DEMO_STATE_VERSION;
        }
        if (Object.keys(patch).length > 0) {
          await setDoc(
            ref,
            {
              ...patch,
              updatedAt: now,
              updatedAtServer: serverTimestamp(),
            },
            { merge: true },
          );
          written += 1;
        }
        continue;
      }
      await setDoc(ref, {
        label: seed.label,
        category: seed.category,
        unit: seed.unit,
        available: seed.available,
        imageUrl: seed.imageUrl ?? null,
        location: seed.location ?? null,
        notes: seed.notes ?? null,
        status: seed.status ?? "active",
        dispatchStatus: seed.dispatchStatus ?? "on_hand",
        lastDispatch: seed.lastDispatch ?? null,
        history: seed.history ?? [],
        demoStateVersion: INVENTORY_DEMO_STATE_VERSION,
        barangayId: brgy.barangayId,
        orgName: brgy.orgName,
        createdAt: now,
        updatedAt: now,
        createdAtServer: serverTimestamp(),
        updatedAtServer: serverTimestamp(),
      });
      written += 1;
    }
  }
  return written;
}
