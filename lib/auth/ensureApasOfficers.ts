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
import { demoPortraitAbsoluteUrl } from "@/lib/auth/demoPortraits";
import { getClientDb, getSecondaryAuth } from "@/lib/firebase/client";
import { APAS_HALL, APAS_ORG_NAME } from "@/lib/households/apasCuratedSeed";
import {
  APAS_AREA_ID,
  APAS_STAFF_SEED,
} from "@/lib/staff/apasStaff";
import type { StaffMemberInput } from "@/lib/staff/types";
import { STAFF_RANK_ORDER } from "@/lib/staff/types";

const DEMO_PASSWORD = "demo1234";

export const APAS_BARANGAY_OFFICERS = APAS_STAFF_SEED.filter(
  (s) => s.scope === "barangay" && s.status === "active",
);

function loginEmail(s: StaffMemberInput): string {
  return (s.accountEmail ?? s.email).trim().toLowerCase();
}

function purokForStaff(s: StaffMemberInput): string {
  if (s.id.includes("tanod-1") || /purok 1/i.test(s.title)) return "Purok 1";
  if (s.id.includes("tanod-2") || /purok 4/i.test(s.title)) return "Purok 4";
  if (s.id.includes("tanod-3") || /night/i.test(s.title)) return "Purok 5";
  if (s.rank === "bhw" || s.rank === "kagawad") return "Purok 2";
  if (s.rank === "mdrrmo" || s.rank === "staff") return "Purok 3";
  return "Purok 1";
}

function pinForStaff(s: StaffMemberInput): { lat: number; lng: number } {
  const i = Math.abs([...s.id].reduce((a, c) => a + c.charCodeAt(0), 0));
  return {
    lat: APAS_HALL.lat + ((i % 17) - 8) * 0.00035,
    lng: APAS_HALL.lng + ((i % 13) - 6) * 0.0004,
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

function staffSyncPatch(s: StaffMemberInput) {
  const now = new Date().toISOString();
  const isCaptain = s.rank === "captain";
  return {
    displayName: s.displayName,
    orgName: isCaptain
      ? "Brgy. Apas · Punong Barangay"
      : `Brgy. Apas · ${s.title}`,
    accountStatus: "active" as const,
    officerRank: isCaptain ? ("captain" as const) : ("officer" as const),
    officerTitle: s.title,
    staffId: s.id,
    reportsToStaffId: s.reportsToId,
    staffRank: s.rank,
    barangay: "Apas",
    lgu: "Cebu City",
    areaId: APAS_AREA_ID,
    activeBarangayId: APAS_AREA_ID,
    idVerified: DEMO_ID_PROOF.idVerified,
    idType: DEMO_ID_PROOF.idType,
    idConfidence: DEMO_ID_PROOF.idConfidence,
    idReason: "Apas staff seed",
    idSource: DEMO_ID_PROOF.idSource,
    idVerifiedAt: now,
    phone: s.phone || "",
    photoURL:
      demoPortraitAbsoluteUrl({
        email: loginEmail(s),
        name: s.displayName,
      }) ??
      `https://i.pravatar.cc/128?u=${encodeURIComponent(s.displayName)}`,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };
}

async function ensureOfficerAuth(
  s: StaffMemberInput,
  hiredByUid: string,
): Promise<string> {
  const email = loginEmail(s);
  if (!email) {
    throw new Error(`${s.displayName}: missing login email`);
  }
  const existing = await findUserUidByEmail(email);
  const patch = staffSyncPatch(s);

  if (existing) {
    await updateDoc(doc(getClientDb(), "users", existing), patch);
    try {
      const secondary = getSecondaryAuth();
      const cred = await signInWithEmailAndPassword(
        secondary,
        email,
        DEMO_PASSWORD,
      );
      await updateProfile(cred.user, {
        displayName: s.displayName,
        photoURL: patch.photoURL,
      });
      await signOut(secondary);
    } catch {
      /* best-effort */
    }
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
      await updateProfile(cred.user, {
        displayName: s.displayName,
        photoURL: patch.photoURL,
      });
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
      await updateProfile(cred.user, {
        displayName: s.displayName,
        photoURL: patch.photoURL,
      });
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
  const notes = `Officer residence · ${s.title} · ${APAS_ORG_NAME}`;

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
      barangay: "Apas",
      lgu: "Cebu City",
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
    return;
  }

  await addDoc(collection(getClientDb(), "households"), {
    ownerName: s.displayName,
    address: `${s.office} · Brgy. Apas`,
    purok,
    phone: s.phone,
    email,
    notes,
    lat: pin.lat,
    lng: pin.lng,
    officerUid: rosterOfficerUid,
    orgName: orgName.trim() || APAS_ORG_NAME,
    members: [],
    linkedCitizenUids: [],
    linkedOfficerUids: [officerUid],
    barangay: "Apas",
    lgu: "Cebu City",
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  });
}

/** Seed Brgy. Apas officers as app users (idempotent). */
export async function ensureApasOfficers(
  rosterOfficerUid: string,
  orgName: string,
): Promise<{ officers: number; households: number; errors: string[] }> {
  const sorted = [...APAS_BARANGAY_OFFICERS].sort((a, b) => {
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
