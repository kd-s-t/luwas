import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { distKm } from "@/lib/geo/bearing";
import { CURATED_NANGKA_HOUSEHOLDS } from "@/lib/households/curatedSeed";
import type {
  Household,
  HouseholdInput,
  HouseholdMember,
  HouseholdPresence,
} from "@/lib/households/types";

/** Firestore batch limit is 500; stay under for clear+seed headroom. */
const BATCH_SIZE = 400;

export function subscribeHouseholds(
  officerUid: string,
  onData: (rows: Household[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  // Single-field filter; sort client-side so emulator works without composite indexes
  const q = query(
    collection(getClientDb(), "households"),
    where("officerUid", "==", officerUid),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows: Household[] = snap.docs.map((d) => {
        const data = d.data();
        const presenceRaw = String(data.presence ?? "unknown");
        const presence: HouseholdPresence =
          presenceRaw === "home" || presenceRaw === "away"
            ? presenceRaw
            : "unknown";
        const members: HouseholdMember[] = [];
        if (Array.isArray(data.members)) {
          for (const m of data.members) {
            if (!m || typeof m !== "object") continue;
            const row = m as Record<string, unknown>;
            const name = String(row.name ?? "").trim();
            if (!name) continue;
            members.push({
              name,
              phone: row.phone != null ? String(row.phone) : undefined,
              email: row.email != null ? String(row.email) : undefined,
              relation:
                row.relation != null ? String(row.relation) : undefined,
            });
          }
        }
        const linked = Array.isArray(data.linkedCitizenUids)
          ? data.linkedCitizenUids.map(String).filter(Boolean)
          : [];
        const linkedOfficers = Array.isArray(data.linkedOfficerUids)
          ? data.linkedOfficerUids.map(String).filter(Boolean)
          : [];
        return {
          id: d.id,
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
              : data.createdAt?.toDate?.()?.toISOString?.() ?? "",
          updatedAt:
            typeof data.updatedAt === "string"
              ? data.updatedAt
              : data.updatedAt?.toDate?.()?.toISOString?.() ??
                (typeof data.createdAt === "string"
                  ? data.createdAt
                  : data.createdAt?.toDate?.()?.toISOString?.() ?? ""),
          presence,
          lastSeenLat:
            typeof data.lastSeenLat === "number" ? data.lastSeenLat : null,
          lastSeenLng:
            typeof data.lastSeenLng === "number" ? data.lastSeenLng : null,
          lastSeenArea:
            data.lastSeenArea != null ? String(data.lastSeenArea) : null,
          lastSeenAt:
            typeof data.lastSeenAt === "string" ? data.lastSeenAt : null,
          members,
          linkedCitizenUids: linked,
          linkedOfficerUids: linkedOfficers,
          barangay: data.barangay != null ? String(data.barangay) : null,
          lgu: data.lgu != null ? String(data.lgu) : null,
        };
      });
      rows.sort((a, b) =>
        (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt),
      );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

export async function addHousehold(
  officerUid: string,
  orgName: string,
  input: HouseholdInput,
): Promise<void> {
  await addDoc(
    collection(getClientDb(), "households"),
    householdDocPayload(officerUid, orgName, input),
  );
}

export async function removeHousehold(id: string): Promise<void> {
  await deleteDoc(doc(getClientDb(), "households", id));
}

export async function clearHouseholds(
  officerUid: string,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const q = query(
    collection(getClientDb(), "households"),
    where("officerUid", "==", officerUid),
  );
  const snap = await getDocs(q);
  const refs = snap.docs.map((d) => d.ref);
  const total = refs.length;
  if (total === 0) {
    onProgress?.(0, 0);
    return;
  }
  let done = 0;
  for (let i = 0; i < refs.length; i += BATCH_SIZE) {
    const chunk = refs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getClientDb());
    for (const ref of chunk) batch.delete(ref);
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total);
  }
}

function householdDocPayload(
  officerUid: string,
  orgName: string,
  input: HouseholdInput,
) {
  const now = new Date().toISOString();
  return {
    ownerName: input.ownerName.trim(),
    address: input.address.trim(),
    purok: input.purok.trim(),
    phone: input.phone.trim(),
    email: input.email.trim().toLowerCase(),
    notes: input.notes.trim(),
    lat: typeof input.lat === "number" ? input.lat : null,
    lng: typeof input.lng === "number" ? input.lng : null,
    officerUid,
    orgName,
    members: input.members ?? [],
    linkedCitizenUids: [] as string[],
    barangay: input.barangay?.trim() || null,
    lgu: input.lgu?.trim() || null,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };
}

export async function updateHouseholdMembers(
  householdId: string,
  members: HouseholdMember[],
): Promise<void> {
  await updateDoc(doc(getClientDb(), "households", householdId), {
    members,
    updatedAt: new Date().toISOString(),
    updatedAtServer: serverTimestamp(),
  });
}

/** Append many households (CSV import). Does not clear existing roster. */
export async function addHouseholds(
  officerUid: string,
  orgName: string,
  inputs: HouseholdInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<number> {
  const total = inputs.length;
  let done = 0;
  const col = collection(getClientDb(), "households");
  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const chunk = inputs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(getClientDb());
    for (const input of chunk) {
      const ref = doc(col);
      batch.set(ref, householdDocPayload(officerUid, orgName, input));
    }
    await batch.commit();
    done += chunk.length;
    onProgress?.(done, total);
  }
  return done;
}

export type SeedHouseholdsProgress = {
  phase: "clearing" | "writing";
  done: number;
  total: number;
};

/** Replace this officer's roster with the given seed (clears old rows first). */
export async function seedHouseholds(
  officerUid: string,
  orgName: string,
  inputs: HouseholdInput[],
  onProgress?: (p: SeedHouseholdsProgress) => void,
): Promise<number> {
  await clearHouseholds(officerUid, (done, total) => {
    onProgress?.({ phase: "clearing", done, total });
  });
  return addHouseholds(officerUid, orgName, inputs, (done, total) => {
    onProgress?.({ phase: "writing", done, total });
  });
}

function curatedMatchKey(h: { email?: string; phone?: string; ownerName?: string }) {
  const email = h.email?.trim().toLowerCase() ?? "";
  if (email) return `email:${email}`;
  const phone = h.phone?.trim().replace(/\D/g, "") ?? "";
  const name = h.ownerName?.trim().toLowerCase() ?? "";
  return `phone:${phone}|name:${name}`;
}

/** Prevent map + house-owners + users from concurrent double-inserts (twin Ken). */
const curatedLocks = new Map<string, Promise<{ added: number; updated: number; deduped: number }>>();

function findCuratedHit(
  input: HouseholdInput,
  roster: Household[],
): Household | null {
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim().replace(/\D/g, "");
  const name = input.ownerName.trim().toLowerCase();
  if (email) {
    const byEmail = roster.find((h) => h.email.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (phone.length >= 10) {
    const byPhone = roster.find(
      (h) => h.phone.trim().replace(/\D/g, "") === phone,
    );
    if (byPhone) return byPhone;
  }
  if (name && input.lat != null && input.lng != null) {
    const byPin = roster.find(
      (h) =>
        h.ownerName.trim().toLowerCase() === name &&
        h.lat != null &&
        h.lng != null &&
        Math.abs(h.lat - input.lat!) < 1e-4 &&
        Math.abs(h.lng - input.lng!) < 1e-4,
    );
    if (byPin) return byPin;
  }
  const key = curatedMatchKey(input);
  return roster.find((h) => curatedMatchKey(h) === key) ?? null;
}

/**
 * Upsert curated Nangka pins (incl. Ken) into an existing roster without a
 * full house-owner reseed — adds missing rows, refreshes contact/coords if present.
 * Then merges duplicate house-owner rows that share email/phone (e.g. twin Ken).
 */
export async function ensureCuratedHouseholds(
  officerUid: string,
  orgName: string,
  existing: Household[],
): Promise<{ added: number; updated: number; deduped: number }> {
  const inflight = curatedLocks.get(officerUid);
  if (inflight) return inflight;

  const run = (async () => {
    const { dedupeHouseholdsByContact } = await import(
      "@/lib/households/match"
    );
    // Always collapse twins first (Ken seed + curated re-add).
    const { removed: preDeduped } =
      await dedupeHouseholdsByContact(officerUid);

    const snap = await getDocs(
      query(
        collection(getClientDb(), "households"),
        where("officerUid", "==", officerUid),
      ),
    );
    const fresh: Household[] = snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
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
        createdAt: "",
        updatedAt: "",
      };
    });

    const roster = fresh.length > 0 ? fresh : existing;
    let added = 0;
    let updated = 0;
    const org = orgName.trim() || "Brgy. Nangka MDRRMO";

    for (const input of CURATED_NANGKA_HOUSEHOLDS) {
      const hit = findCuratedHit(input, roster);
      if (!hit) {
        // Re-check email in Firestore so a parallel tab can't create a twin.
        const email = input.email.trim().toLowerCase();
        if (email) {
          const live = await getDocs(
            query(
              collection(getClientDb(), "households"),
              where("email", "==", email),
            ),
          );
          const mine = live.docs.find(
            (d) => String(d.data().officerUid ?? "") === officerUid,
          );
          if (mine) {
            const id = mine.id;
            const now = new Date().toISOString();
            await updateDoc(doc(getClientDb(), "households", id), {
              ownerName: input.ownerName.trim(),
              address: input.address.trim(),
              purok: input.purok.trim(),
              phone: input.phone.trim(),
              email,
              notes: input.notes.trim(),
              lat: typeof input.lat === "number" ? input.lat : null,
              lng: typeof input.lng === "number" ? input.lng : null,
              ...(input.members ? { members: input.members } : {}),
              updatedAt: now,
              updatedAtServer: serverTimestamp(),
            });
            updated += 1;
            roster.push({
              id,
              ownerName: input.ownerName.trim(),
              address: input.address.trim(),
              purok: input.purok.trim(),
              phone: input.phone.trim(),
              email,
              notes: input.notes.trim(),
              lat: input.lat ?? null,
              lng: input.lng ?? null,
              officerUid,
              orgName: org,
              createdAt: "",
              updatedAt: now,
            });
            continue;
          }
        }
        await addHousehold(officerUid, org, input);
        added += 1;
        continue;
      }
      const email = input.email.trim().toLowerCase();
      const needsUpdate =
        hit.ownerName !== input.ownerName.trim() ||
        hit.phone !== input.phone.trim() ||
        hit.email.trim().toLowerCase() !== email ||
        hit.purok !== input.purok.trim() ||
        hit.address !== input.address.trim() ||
        hit.notes !== input.notes.trim() ||
        hit.lat !== (input.lat ?? null) ||
        hit.lng !== (input.lng ?? null);
      if (!needsUpdate && !(input.members && input.members.length > 0)) continue;
      const now = new Date().toISOString();
      await updateDoc(doc(getClientDb(), "households", hit.id), {
        ownerName: input.ownerName.trim(),
        address: input.address.trim(),
        purok: input.purok.trim(),
        phone: input.phone.trim(),
        email,
        notes: input.notes.trim(),
        lat: typeof input.lat === "number" ? input.lat : null,
        lng: typeof input.lng === "number" ? input.lng : null,
        ...(input.members ? { members: input.members } : {}),
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      });
      updated += 1;
    }

    const { removed: postDeduped } =
      await dedupeHouseholdsByContact(officerUid);

    return {
      added,
      updated,
      deduped: preDeduped + postDeduped,
    };
  })().finally(() => {
    curatedLocks.delete(officerUid);
  });

  curatedLocks.set(officerUid, run);
  return run;
}

/** ~1.2 km from home pin counts as still “at home” / in-brgy. */
const HOME_RADIUS_KM = 1.2;

type PresenceLocateInput = {
  lat: number;
  lng: number;
  /** e.g. "Brgy. Mabolo, Cebu City" */
  areaLabel: string;
  /** Registered home barangay (e.g. Nangka). */
  homeBarangay?: string;
  /** Barangay resolved from GPS. */
  locatedBarangay?: string;
};

function presenceFromLocate(
  homeLat: number | null,
  homeLng: number | null,
  input: PresenceLocateInput,
): HouseholdPresence {
  const homeBrgy = input.homeBarangay?.trim().toLowerCase();
  const hereBrgy = input.locatedBarangay?.trim().toLowerCase();
  if (homeBrgy && hereBrgy && homeBrgy !== hereBrgy) return "away";

  if (homeLat != null && homeLng != null) {
    const nearHome =
      distKm(
        { lat: homeLat, lng: homeLng },
        { lat: input.lat, lng: input.lng },
      ) <= HOME_RADIUS_KM;
    return nearHome ? "home" : "away";
  }

  if (homeBrgy && hereBrgy && homeBrgy === hereBrgy) return "home";
  return "away";
}

/**
 * Citizen locate → update roster presence for households matching email.
 * Home pin stays put; lastSeen* records where they are now.
 */
export async function updateHouseholdPresenceByEmail(
  email: string,
  input: PresenceLocateInput,
): Promise<number> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return 0;

  const snap = await getDocs(
    query(
      collection(getClientDb(), "households"),
      where("email", "==", normalized),
    ),
  );
  const matches = snap.docs;
  if (matches.length === 0) return 0;

  const now = new Date().toISOString();
  let n = 0;
  for (const d of matches) {
    const data = d.data();
    const homeLat = typeof data.lat === "number" ? data.lat : null;
    const homeLng = typeof data.lng === "number" ? data.lng : null;
    const presence = presenceFromLocate(homeLat, homeLng, input);
    await updateDoc(d.ref, {
      presence,
      lastSeenLat: input.lat,
      lastSeenLng: input.lng,
      lastSeenArea:
        presence === "home"
          ? "At home barangay"
          : input.areaLabel.trim() || "Outside home barangay",
      lastSeenAt: now,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    n += 1;
  }
  return n;
}
