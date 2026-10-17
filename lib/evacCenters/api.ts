import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_EVAC_CENTER_SEED,
  APAS_ORG_NAME,
} from "@/lib/evacCenters/apasSeed";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_EVAC_CENTER_SEED,
  NANGKA_ORG_NAME,
} from "@/lib/evacCenters/nangkaSeed";
import {
  asEvacCondition,
  emptyEvacStock,
  type EvacCenter,
  type EvacCenterInput,
  type EvacCenterStock,
} from "@/lib/evacCenters/types";

const COL = "evacCenters";

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

function asStock(raw: unknown): EvacCenterStock {
  const base = emptyEvacStock();
  if (!raw || typeof raw !== "object") return base;
  const row = raw as Record<string, unknown>;
  return {
    foodPacks: Math.max(0, Number(row.foodPacks ?? 0) || 0),
    waterLiters: Math.max(0, Number(row.waterLiters ?? 0) || 0),
    blankets: Math.max(0, Number(row.blankets ?? 0) || 0),
    medicalKits: Math.max(0, Number(row.medicalKits ?? 0) || 0),
    other: typeof row.other === "string" ? row.other : "",
  };
}

function mapDoc(id: string, data: Record<string, unknown>): EvacCenter {
  return {
    id,
    name: String(data.name ?? ""),
    locationLabel: String(data.locationLabel ?? ""),
    lat: typeof data.lat === "number" ? data.lat : Number(data.lat) || 0,
    lng: typeof data.lng === "number" ? data.lng : Number(data.lng) || 0,
    maxCapacity: Math.max(
      0,
      typeof data.maxCapacity === "number"
        ? data.maxCapacity
        : Number(data.maxCapacity) || 0,
    ),
    occupancy: Math.max(
      0,
      typeof data.occupancy === "number"
        ? data.occupancy
        : Number(data.occupancy) || 0,
    ),
    condition: asEvacCondition(data.condition),
    stock: asStock(data.stock),
    notes: typeof data.notes === "string" ? data.notes : undefined,
    open24h: Boolean(data.open24h),
    status: data.status === "inactive" ? "inactive" : "active",
    barangayId: String(data.barangayId ?? NANGKA_BARANGAY_ID),
    lgu: String(data.lgu ?? "Consolacion"),
    orgName: String(data.orgName ?? NANGKA_ORG_NAME),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

export function subscribeEvacCenters(
  barangayId: string,
  onData: (rows: EvacCenter[]) => void,
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
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addEvacCenter(
  barangayId: string,
  orgName: string,
  lgu: string,
  input: EvacCenterInput,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Center name is required.");
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    throw new Error("Valid latitude and longitude are required.");
  }
  if (input.maxCapacity < 0) {
    throw new Error("Max capacity cannot be negative.");
  }
  if (input.occupancy < 0) {
    throw new Error("Occupancy cannot be negative.");
  }
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getClientDb(), COL), {
    name,
    locationLabel: input.locationLabel.trim(),
    lat: input.lat,
    lng: input.lng,
    maxCapacity: Math.round(input.maxCapacity),
    occupancy: Math.round(input.occupancy),
    condition: asEvacCondition(input.condition),
    stock: {
      foodPacks: Math.max(0, Math.round(input.stock.foodPacks)),
      waterLiters: Math.max(0, Math.round(input.stock.waterLiters)),
      blankets: Math.max(0, Math.round(input.stock.blankets)),
      medicalKits: Math.max(0, Math.round(input.stock.medicalKits)),
      other: input.stock.other.trim(),
    },
    notes: input.notes?.trim() || null,
    open24h: Boolean(input.open24h),
    status: input.status ?? "active",
    barangayId,
    lgu: lgu.trim() || "Consolacion",
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return ref.id;
}

export async function updateEvacCenter(
  id: string,
  patch: Partial<EvacCenterInput>,
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };
  if (patch.name != null) payload.name = patch.name.trim();
  if (patch.locationLabel != null) {
    payload.locationLabel = patch.locationLabel.trim();
  }
  if (patch.lat != null) payload.lat = patch.lat;
  if (patch.lng != null) payload.lng = patch.lng;
  if (patch.maxCapacity != null) {
    payload.maxCapacity = Math.max(0, Math.round(patch.maxCapacity));
  }
  if (patch.occupancy != null) {
    payload.occupancy = Math.max(0, Math.round(patch.occupancy));
  }
  if (patch.condition != null) {
    payload.condition = asEvacCondition(patch.condition);
  }
  if (patch.stock != null) {
    payload.stock = {
      foodPacks: Math.max(0, Math.round(patch.stock.foodPacks)),
      waterLiters: Math.max(0, Math.round(patch.stock.waterLiters)),
      blankets: Math.max(0, Math.round(patch.stock.blankets)),
      medicalKits: Math.max(0, Math.round(patch.stock.medicalKits)),
      other: patch.stock.other.trim(),
    };
  }
  if (patch.notes !== undefined) {
    payload.notes = patch.notes?.trim() || null;
  }
  if (patch.open24h != null) payload.open24h = Boolean(patch.open24h);
  if (patch.status != null) payload.status = patch.status;
  await updateDoc(doc(getClientDb(), COL, id), payload);
}

function looksLikeCoordProvenance(label: string): boolean {
  return /google places|plus code|nominatim|\bosm\b/i.test(label);
}

async function ensureEvacCenterSeeds(
  seeds: typeof NANGKA_EVAC_CENTER_SEED,
  barangayId: string,
  orgName: string,
): Promise<number> {
  let created = 0;
  for (const seed of seeds) {
    const ref = doc(getClientDb(), COL, seed.id);
    const snap = await getDoc(ref);
    const now = new Date().toISOString();
    if (snap.exists()) {
      const data = snap.data() as Record<string, unknown>;
      const label =
        typeof data.locationLabel === "string" ? data.locationLabel : "";
      const stock =
        data.stock && typeof data.stock === "object"
          ? (data.stock as Record<string, unknown>)
          : null;
      const other =
        stock && typeof stock.other === "string" ? stock.other.trim() : "";
      const patch: Record<string, unknown> = {};
      if (looksLikeCoordProvenance(label)) {
        patch.locationLabel = seed.locationLabel;
      }
      if (/^open\s*24/i.test(other)) {
        patch.stock = { ...stock, other: "" };
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        patch.updatedAtServer = serverTimestamp();
        await updateDoc(ref, patch);
      }
      continue;
    }
    await setDoc(ref, {
      name: seed.name,
      locationLabel: seed.locationLabel,
      lat: seed.lat,
      lng: seed.lng,
      maxCapacity: seed.maxCapacity,
      occupancy: seed.occupancy,
      condition: asEvacCondition(seed.condition),
      stock: seed.stock,
      notes: seed.notes ?? null,
      open24h: Boolean(seed.open24h),
      status: "active",
      barangayId,
      lgu: seed.lgu,
      orgName,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });
    created += 1;
  }
  return created;
}

/** Seed curated Nangka ECs once; refresh leftover provenance labels. */
export async function ensureNangkaEvacCenters(): Promise<void> {
  await ensureEvacCenterSeeds(
    NANGKA_EVAC_CENTER_SEED,
    NANGKA_BARANGAY_ID,
    NANGKA_ORG_NAME,
  );
}

/** Seed curated Apas ECs once. */
export async function ensureApasEvacCenters(): Promise<number> {
  return ensureEvacCenterSeeds(
    APAS_EVAC_CENTER_SEED,
    APAS_BARANGAY_DOC_ID,
    APAS_ORG_NAME,
  );
}
