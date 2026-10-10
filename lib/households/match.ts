import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { Household } from "@/lib/households/types";

function mapHouseholdDoc(
  id: string,
  data: Record<string, unknown>,
): Household {
  const presenceRaw = String(data.presence ?? "unknown");
  const presence =
    presenceRaw === "home" || presenceRaw === "away" ? presenceRaw : "unknown";
  const membersRaw = Array.isArray(data.members) ? data.members : [];
  const linkedRaw = Array.isArray(data.linkedCitizenUids)
    ? data.linkedCitizenUids
    : [];
  return {
    id,
    ownerName: String(data.ownerName ?? ""),
    address: String(data.address ?? ""),
    purok: String(data.purok ?? ""),
    phone: String(data.phone ?? ""),
    email: String(data.email ?? ""),
    notes: String(data.notes ?? ""),
    lat: typeof data.lat === "number" ? data.lat : null,
    lng: typeof data.lng === "number" ? data.lng : null,
    officerUid: String(data.officerUid ?? ""),
    orgName: String(data.orgName ?? ""),
    createdAt:
      typeof data.createdAt === "string"
        ? data.createdAt
        : (data.createdAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
          "",
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : (data.updatedAt as { toDate?: () => Date })?.toDate?.()?.toISOString?.() ??
          "",
    presence,
    lastSeenLat: typeof data.lastSeenLat === "number" ? data.lastSeenLat : null,
    lastSeenLng: typeof data.lastSeenLng === "number" ? data.lastSeenLng : null,
    lastSeenArea:
      data.lastSeenArea != null ? String(data.lastSeenArea) : null,
    lastSeenAt: typeof data.lastSeenAt === "string" ? data.lastSeenAt : null,
    members: membersRaw
      .map((m) => {
        if (!m || typeof m !== "object") return null;
        const row = m as Record<string, unknown>;
        const name = String(row.name ?? "").trim();
        if (!name) return null;
        return {
          name,
          phone: row.phone != null ? String(row.phone) : undefined,
          email: row.email != null ? String(row.email) : undefined,
          relation: row.relation != null ? String(row.relation) : undefined,
        };
      })
      .filter((m): m is NonNullable<typeof m> => Boolean(m)),
    linkedCitizenUids: linkedRaw.map(String).filter(Boolean),
    barangay: data.barangay != null ? String(data.barangay) : null,
    lgu: data.lgu != null ? String(data.lgu) : null,
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.trim().replace(/\D/g, "");
}

/** Find a house-owner row for citizen auto-validate. */
export async function findMatchingHousehold(input: {
  email: string;
  phone: string;
  displayName: string;
  purok: string;
  barangay?: string;
}): Promise<Household | null> {
  const db = getClientDb();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const name = input.displayName.trim().toLowerCase();
  const purok = input.purok.trim().toLowerCase();
  const barangay = input.barangay?.trim().toLowerCase();

  if (email) {
    const snap = await getDocs(
      query(collection(db, "households"), where("email", "==", email)),
    );
    const rows = snap.docs.map((d) => mapHouseholdDoc(d.id, d.data()));
    const scoped = barangay
      ? rows.filter(
          (h) =>
            !h.barangay ||
            h.barangay.toLowerCase() === barangay ||
            h.orgName.toLowerCase().includes(barangay),
        )
      : rows;
    if (scoped.length > 0) {
      // Prefer keeper with links / presence when duplicate house-owner rows exist.
      scoped.sort((a, b) => {
        const score = (h: Household) =>
          (h.linkedCitizenUids?.length ?? 0) * 10 +
          (h.presence === "away" || h.presence === "home" ? 5 : 0) +
          (h.lastSeenAt ? 3 : 0);
        return score(b) - score(a);
      });
      return scoped[0]!;
    }
  }

  // Phone / name match — scan officer rosters is expensive; use phone equality when indexed.
  if (phone.length >= 10) {
    const snap = await getDocs(
      query(collection(db, "households"), where("phone", "==", input.phone.trim())),
    );
    let rows = snap.docs.map((d) => mapHouseholdDoc(d.id, d.data()));
    if (rows.length === 0) {
      // Also try digits-only stored phones
      const allPhone = await getDocs(
        query(collection(db, "households"), where("phone", "==", phone)),
      );
      rows = allPhone.docs.map((d) => mapHouseholdDoc(d.id, d.data()));
    }
    const hit = rows.find((h) => normalizePhone(h.phone) === phone);
    if (hit) return hit;
  }

  if (name && purok) {
    // Limited scan: same purok string
    const snap = await getDocs(
      query(collection(db, "households"), where("purok", "==", input.purok.trim())),
    );
    const rows = snap.docs.map((d) => mapHouseholdDoc(d.id, d.data()));
    const hit = rows.find(
      (h) =>
        h.ownerName.trim().toLowerCase() === name &&
        h.purok.trim().toLowerCase() === purok,
    );
    if (hit) return hit;
  }

  return null;
}

/** Link citizen uid to household without creating a new roster row. */
export async function linkCitizenToHousehold(
  householdId: string,
  citizenUid: string,
): Promise<void> {
  const { getDoc } = await import("firebase/firestore");
  const ref = doc(getClientDb(), "households", householdId);
  const docSnap = await getDoc(ref);
  if (!docSnap.exists()) return;
  const data = docSnap.data();
  const existing = Array.isArray(data.linkedCitizenUids)
    ? data.linkedCitizenUids.map(String)
    : [];
  if (existing.includes(citizenUid)) return;
  const now = new Date().toISOString();
  await updateDoc(ref, {
    linkedCitizenUids: [...existing, citizenUid],
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

/**
 * Heal house-owner ↔ citizen app links when the citizen already exists
 * (householdId set and/or same email as the roster row) but linkedCitizenUids
 * was never written — e.g. Ken registered, badge still says Not registered.
 */
export async function healHouseholdCitizenLinks(
  households: Pick<Household, "id" | "email" | "linkedCitizenUids">[],
): Promise<{ linked: number }> {
  if (households.length === 0) return { linked: 0 };
  const db = getClientDb();
  let linked = 0;

  for (const h of households) {
    const already = new Set(h.linkedCitizenUids ?? []);
    const uids = new Set<string>();

    const byHh = await getDocs(
      query(collection(db, "users"), where("householdId", "==", h.id)),
    );
    for (const d of byHh.docs) {
      if (String(d.data().role ?? "") === "citizen") uids.add(d.id);
    }

    const email = normalizeEmail(h.email);
    if (email) {
      const byEmail = await getDocs(
        query(collection(db, "users"), where("email", "==", email)),
      );
      for (const d of byEmail.docs) {
        if (String(d.data().role ?? "") === "citizen") uids.add(d.id);
      }
    }

    for (const uid of uids) {
      if (!already.has(uid)) {
        await linkCitizenToHousehold(h.id, uid);
        already.add(uid);
        linked += 1;
      }
      await updateDoc(doc(db, "users", uid), {
        householdId: h.id,
        accountStatus: "active",
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      });
    }
  }

  return { linked };
}

function householdDedupeKeys(h: Household): string[] {
  const keys: string[] = [];
  const email = normalizeEmail(h.email);
  const phone = normalizePhone(h.phone);
  const name = h.ownerName.trim().toLowerCase();
  if (email) keys.push(`email:${email}`);
  if (phone.length >= 10) keys.push(`phone:${phone}`);
  if (name && phone.length >= 10) keys.push(`namephone:${name}|${phone}`);
  if (h.lat != null && h.lng != null && name) {
    // Same person / same home pin (Ken twins share identical coords).
    keys.push(
      `pin:${name}|${h.lat.toFixed(5)},${h.lng.toFixed(5)}`,
    );
  }
  if (keys.length === 0) keys.push(`id:${h.id}`);
  return keys;
}

function mergeHouseholdGroup(list: Household[]): {
  keep: Household;
  drop: Household[];
} {
  const ranked = [...list].sort((a, b) => {
    const score = (h: Household) =>
      (h.linkedCitizenUids?.length ?? 0) * 10 +
      (h.presence === "away" || h.presence === "home" ? 5 : 0) +
      (h.lastSeenAt ? 3 : 0) +
      (h.members?.length ?? 0) +
      (h.notes?.length ?? 0) / 100;
    return score(b) - score(a);
  });
  return { keep: ranked[0]!, drop: ranked.slice(1) };
}

/**
 * Merge duplicate households that share email, phone, name+phone, or home pin.
 * Keeps the row with the richest presence / most links; deletes the rest.
 */
export async function dedupeHouseholdsByContact(
  officerUid: string,
): Promise<{ removed: number }> {
  const snap = await getDocs(
    query(
      collection(getClientDb(), "households"),
      where("officerUid", "==", officerUid),
    ),
  );
  const rows = snap.docs.map((d) => mapHouseholdDoc(d.id, d.data()));

  // Union-find style: merge all groups that share any contact/pin key.
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    const p = parent.get(id) ?? id;
    if (p !== id) {
      const root = find(p);
      parent.set(id, root);
      return root;
    }
    return id;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const h of rows) parent.set(h.id, h.id);

  const keyToIds = new Map<string, string[]>();
  for (const h of rows) {
    for (const key of householdDedupeKeys(h)) {
      const list = keyToIds.get(key) ?? [];
      list.push(h.id);
      keyToIds.set(key, list);
    }
  }
  for (const ids of keyToIds.values()) {
    for (let i = 1; i < ids.length; i++) union(ids[0]!, ids[i]!);
  }

  const clusters = new Map<string, Household[]>();
  for (const h of rows) {
    const root = find(h.id);
    const list = clusters.get(root) ?? [];
    list.push(h);
    clusters.set(root, list);
  }

  let removed = 0;
  const db = getClientDb();
  for (const list of clusters.values()) {
    if (list.length < 2) continue;
    const { keep, drop } = mergeHouseholdGroup(list);
    const linked = new Set(keep.linkedCitizenUids ?? []);
    for (const d of drop) {
      for (const uid of d.linkedCitizenUids ?? []) linked.add(uid);
    }
    const richNotes =
      [keep, ...drop].sort(
        (a, b) => (b.notes?.length ?? 0) - (a.notes?.length ?? 0),
      )[0]?.notes ?? keep.notes;

    // Prefer curated Ken notes (citizen accounts) over seed "N household members".
    const curatedNotes =
      drop.find((d) => /citizen account/i.test(d.notes ?? ""))?.notes ||
      (/citizen account/i.test(keep.notes ?? "") ? keep.notes : richNotes);

    const batch = writeBatch(db);
    batch.update(doc(db, "households", keep.id), {
      linkedCitizenUids: [...linked],
      members: keep.members?.length
        ? keep.members
        : drop.find((d) => d.members?.length)?.members ?? [],
      notes: curatedNotes,
      email:
        normalizeEmail(keep.email) ||
        normalizeEmail(drop.find((d) => d.email)?.email ?? ""),
      phone: keep.phone || drop.find((d) => d.phone)?.phone || "",
      presence:
        keep.presence !== "unknown"
          ? keep.presence
          : drop.find((d) => d.presence !== "unknown")?.presence ?? "unknown",
      lastSeenAt:
        keep.lastSeenAt ?? drop.find((d) => d.lastSeenAt)?.lastSeenAt ?? null,
      lastSeenArea:
        keep.lastSeenArea ??
        drop.find((d) => d.lastSeenArea)?.lastSeenArea ??
        null,
      lastSeenLat:
        keep.lastSeenLat ??
        drop.find((d) => d.lastSeenLat != null)?.lastSeenLat ??
        null,
      lastSeenLng:
        keep.lastSeenLng ??
        drop.find((d) => d.lastSeenLng != null)?.lastSeenLng ??
        null,
      lat: keep.lat ?? drop.find((d) => d.lat != null)?.lat ?? null,
      lng: keep.lng ?? drop.find((d) => d.lng != null)?.lng ?? null,
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    });
    for (const d of drop) {
      batch.delete(doc(db, "households", d.id));
      removed += 1;
    }
    await batch.commit();
  }
  return { removed };
}
