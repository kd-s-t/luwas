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
import {
  APAS_BARANGAY_DOC_ID,
  APAS_ORG_NAME,
  APAS_PARTNER_SEED,
} from "@/lib/partners/apasPartners";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
  NANGKA_PARTNER_SEED,
} from "@/lib/partners/nangkaPartners";
import type {
  PartnerSupply,
  PartnerType,
  ResourcePartner,
  ResourcePartnerInput,
} from "@/lib/partners/types";

const COL = "resourcePartners";

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

function asSupplies(raw: unknown): PartnerSupply[] {
  if (!Array.isArray(raw)) return [];
  const allowed: PartnerSupply[] = [
    "medical",
    "food",
    "water",
    "transport",
    "shelter",
    "other",
  ];
  return raw
    .map(String)
    .filter((s): s is PartnerSupply =>
      allowed.includes(s as PartnerSupply),
    );
}

function mapDoc(id: string, data: Record<string, unknown>): ResourcePartner {
  const typeRaw = String(data.type ?? "other");
  const type: PartnerType =
    typeRaw === "ngo" ||
    typeRaw === "dswd" ||
    typeRaw === "lgu" ||
    typeRaw === "private"
      ? typeRaw
      : "other";
  return {
    id,
    name: String(data.name ?? ""),
    type,
    contactName: String(data.contactName ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    logoUrl:
      typeof data.logoUrl === "string" && data.logoUrl.trim()
        ? data.logoUrl.trim()
        : undefined,
    lat: (() => {
      const n = Number(data.lat);
      return Number.isFinite(n) ? n : undefined;
    })(),
    lng: (() => {
      const n = Number(data.lng);
      return Number.isFinite(n) ? n : undefined;
    })(),
    supplies: asSupplies(data.supplies),
    coverage: String(data.coverage ?? ""),
    notes: typeof data.notes === "string" ? data.notes : undefined,
    status: data.status === "inactive" ? "inactive" : "active",
    barangayId: String(data.barangayId ?? NANGKA_BARANGAY_ID),
    orgName: String(data.orgName ?? NANGKA_ORG_NAME),
    createdAt: asIso(data.createdAt, data.createdAtServer),
    updatedAt: asIso(data.updatedAt, data.updatedAtServer),
  };
}

export function subscribeResourcePartners(
  barangayId: string,
  onData: (rows: ResourcePartner[]) => void,
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
        .filter((p) => p.status === "active");
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addResourcePartner(
  barangayId: string,
  orgName: string,
  input: ResourcePartnerInput,
): Promise<string> {
  const name = input.name.trim();
  if (!name) throw new Error("Partner name is required.");
  const now = new Date().toISOString();
  const ref = await addDoc(collection(getClientDb(), COL), {
    name,
    type: input.type,
    contactName: input.contactName.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    logoUrl: input.logoUrl?.trim() || null,
    lat: typeof input.lat === "number" ? input.lat : null,
    lng: typeof input.lng === "number" ? input.lng : null,
    supplies: input.supplies,
    coverage: input.coverage.trim(),
    notes: input.notes?.trim() || null,
    status: input.status ?? "active",
    barangayId,
    orgName,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
  return ref.id;
}

async function ensurePartnerSeeds(
  seeds: typeof NANGKA_PARTNER_SEED,
  barangayId: string,
  orgName: string,
): Promise<number> {
  const db = getClientDb();
  let written = 0;
  for (const seed of seeds) {
    const ref = doc(db, COL, seed.id);
    const existing = await getDoc(ref);
    const now = new Date().toISOString();
    if (existing.exists()) {
      const data = existing.data() as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      if (!String(data.email ?? "").trim() && seed.email) {
        patch.email = seed.email;
      }
      if (!String(data.logoUrl ?? "").trim() && seed.logoUrl) {
        patch.logoUrl = seed.logoUrl;
      }
      if (
        (typeof data.lat !== "number" || typeof data.lng !== "number") &&
        typeof seed.lat === "number" &&
        typeof seed.lng === "number"
      ) {
        patch.lat = seed.lat;
        patch.lng = seed.lng;
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
      name: seed.name,
      type: seed.type,
      contactName: seed.contactName,
      phone: seed.phone,
      email: seed.email,
      logoUrl: seed.logoUrl ?? null,
      lat: seed.lat ?? null,
      lng: seed.lng ?? null,
      supplies: seed.supplies,
      coverage: seed.coverage,
      notes: seed.notes ?? null,
      status: seed.status ?? "active",
      barangayId,
      orgName,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });
    written += 1;
  }
  return written;
}

/** Idempotent seed for Nangka demo partners. */
export async function ensureNangkaPartners(): Promise<number> {
  return ensurePartnerSeeds(
    NANGKA_PARTNER_SEED,
    NANGKA_BARANGAY_ID,
    NANGKA_ORG_NAME,
  );
}

/** Idempotent seed for Apas demo partners. */
export async function ensureApasPartners(): Promise<number> {
  return ensurePartnerSeeds(
    APAS_PARTNER_SEED,
    APAS_BARANGAY_DOC_ID,
    APAS_ORG_NAME,
  );
}
