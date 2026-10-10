import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { DEMO_ID_PROOF } from "@/lib/auth/demoAccount";
import { getClientDb, getSecondaryAuth } from "@/lib/firebase/client";
import {
  NANGKA_ORG_NAME,
  NANGKA_STAFF_SEED,
} from "@/lib/staff/nangkaStaff";
import type { StaffMemberInput } from "@/lib/staff/types";
import { STAFF_RANK_ORDER } from "@/lib/staff/types";

const DEMO_PASSWORD = "demo1234";

/** Barangay working roster (excludes LGU-only — they stay municipal). */
export const NANGKA_BARANGAY_OFFICERS = NANGKA_STAFF_SEED.filter(
  (s) => s.scope === "barangay" && s.status === "active",
);

function loginEmail(s: StaffMemberInput): string {
  return (s.accountEmail ?? s.email).trim().toLowerCase();
}

function purokForStaff(s: StaffMemberInput): string {
  if (s.id.includes("tanod-1") || /purok 1/i.test(s.title)) return "Purok 1";
  if (s.id.includes("tanod-2") || /purok 4/i.test(s.title)) return "Purok 4";
  if (s.rank === "bhw" || s.rank === "kagawad") return "Purok 2";
  if (s.rank === "mdrrmo" || s.rank === "staff") return "Purok 3";
  return "Purok 1";
}

/** Rough home pins near Nangka hall so officers show on the map. */
function pinForStaff(s: StaffMemberInput): { lat: number; lng: number } {
  const i = Math.abs(
    [...s.id].reduce((a, c) => a + c.charCodeAt(0), 0),
  );
  const baseLat = 10.370744;
  const baseLng = 123.959104;
  return {
    lat: baseLat + ((i % 17) - 8) * 0.00035,
    lng: baseLng + ((i % 13) - 6) * 0.0004,
  };
}

async function findUserUidByEmail(email: string): Promise<string | null> {
  const snap = await getDocs(
    query(
      collection(getClientDb(), "users"),
      where("email", "==", email.trim().toLowerCase()),
    ),
  );
  return snap.docs[0]?.id ?? null;
}

/** Fields allowed by firestore officer-sync update rule (no email/role). */
function staffSyncPatch(s: StaffMemberInput) {
  const now = new Date().toISOString();
  const isCaptain = s.rank === "captain";
  return {
    displayName: s.displayName,
    orgName: isCaptain
      ? "Brgy. Nangka · Punong Barangay"
      : `Brgy. Nangka · ${s.title}`,
    accountStatus: "active" as const,
    officerRank: isCaptain ? ("captain" as const) : ("officer" as const),
    officerTitle: s.title,
    staffId: s.id,
    reportsToStaffId: s.reportsToId,
    staffRank: s.rank,
    barangay: "Nangka",
    lgu: "Consolacion",
    areaId: "consolacion/nangka",
    activeBarangayId: "consolacion/nangka",
    idVerified: DEMO_ID_PROOF.idVerified,
    idType: DEMO_ID_PROOF.idType,
    idConfidence: DEMO_ID_PROOF.idConfidence,
    idReason: "Nangka staff seed",
    idSource: DEMO_ID_PROOF.idSource,
    idVerifiedAt: now,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };
}

async function ensureOfficerAuth(
  s: StaffMemberInput,
  hiredByUid: string,
): Promise<string> {
  const email = loginEmail(s);
  const existing = await findUserUidByEmail(email);
  const patch = staffSyncPatch(s);

  if (existing) {
    await updateDoc(doc(getClientDb(), "users", existing), patch);
    return existing;
  }

  const secondary = getSecondaryAuth();
  try {
    let uid: string;
    try {
      const cred = await createUserWithEmailAndPassword(
        secondary,
        email,
        DEMO_PASSWORD,
      );
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: s.displayName });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code !== "auth/email-already-in-use") throw err;
      const cred = await signInWithEmailAndPassword(
        secondary,
        email,
        DEMO_PASSWORD,
      );
      uid = cred.user.uid;
    }

    const now = new Date().toISOString();
    await setDoc(doc(getClientDb(), "users", uid), {
      uid,
      email,
      role: "officer",
      createdAt: now,
      createdAtServer: serverTimestamp(),
      hiredAt: now,
      hiredByUid,
      employmentHistory: [
        {
          at: now,
          byUid: hiredByUid,
          byName: "System seed",
          action: "hired",
          title: s.title,
        },
      ],
      ...patch,
    });
    await signOut(secondary);
    return uid;
  } catch (err) {
    try {
      await signOut(secondary);
    } catch {
      /* ignore */
    }
    throw err;
  }
}

async function linkOfficerHousehold(
  rosterOfficerUid: string,
  orgName: string,
  s: StaffMemberInput,
  officerUid: string,
): Promise<void> {
  const email = loginEmail(s);
  const snap = await getDocs(
    query(collection(getClientDb(), "households"), where("email", "==", email)),
  );
  const mine = snap.docs.find(
    (d) => String(d.data().officerUid ?? "") === rosterOfficerUid,
  );
  const pin = pinForStaff(s);
  const purok = purokForStaff(s);
  const now = new Date().toISOString();
  const notes = `Officer residence · ${s.title} · ${NANGKA_ORG_NAME}`;

  if (mine) {
    const data = mine.data();
    const linked = Array.isArray(data.linkedOfficerUids)
      ? data.linkedOfficerUids.map(String)
      : [];
    if (!linked.includes(officerUid)) linked.push(officerUid);
    await updateDoc(mine.ref, {
      ownerName: s.displayName,
      phone: s.phone,
      email,
      notes,
      purok,
      linkedOfficerUids: linked,
      barangay: "Nangka",
      lgu: "Consolacion",
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return;
  }

  await addDoc(collection(getClientDb(), "households"), {
    ownerName: s.displayName,
    address: `${s.office} · Brgy. Nangka`,
    purok,
    phone: s.phone,
    email,
    notes,
    lat: pin.lat,
    lng: pin.lng,
    officerUid: rosterOfficerUid,
    orgName: orgName.trim() || "Brgy. Nangka MDRRMO",
    members: [],
    linkedCitizenUids: [],
    linkedOfficerUids: [officerUid],
    barangay: "Nangka",
    lgu: "Consolacion",
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

/**
 * Seed correct Brgy. Nangka officers (staff directory) as app users,
 * and attach each to a house-owner row on the caller's roster.
 * Continues past per-person failures so one bad update cannot leave only 2 cards.
 */
export async function ensureNangkaOfficers(
  rosterOfficerUid: string,
  orgName: string,
): Promise<{ officers: number; households: number; errors: string[] }> {
  const sorted = [...NANGKA_BARANGAY_OFFICERS].sort((a, b) => {
    const ra = STAFF_RANK_ORDER[a.rank] ?? 99;
    const rb = STAFF_RANK_ORDER[b.rank] ?? 99;
    return ra - rb;
  });

  let officers = 0;
  let households = 0;
  const errors: string[] = [];

  for (const s of sorted) {
    try {
      const uid = await ensureOfficerAuth(s, rosterOfficerUid);
      officers += 1;
      try {
        await linkOfficerHousehold(rosterOfficerUid, orgName, s, uid);
        households += 1;
      } catch (err) {
        errors.push(
          `${s.displayName} (house): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } catch (err) {
      errors.push(
        `${s.displayName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
  return { officers, households, errors };
}
