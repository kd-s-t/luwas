import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { DEMO_CITIZENS, DEMO_ID_PROOF } from "@/lib/auth/demoAccount";
import {
  dedupeHouseholdsByContact,
  linkCitizenToHousehold,
} from "@/lib/households/match";
import { getClientDb, getSecondaryAuth } from "@/lib/firebase/client";

const KEN_HOUSEHOLD_EMAIL = "kendantinio@gmail.com";

type HouseholdCitizen = (typeof DEMO_CITIZENS)[number] & {
  householdEmail: string;
};

function citizensWithHousehold(): HouseholdCitizen[] {
  return DEMO_CITIZENS.filter(
    (c): c is HouseholdCitizen =>
      "householdEmail" in c &&
      typeof (c as { householdEmail?: string }).householdEmail === "string" &&
      Boolean((c as { householdEmail: string }).householdEmail),
  );
}

/** Demo citizens that live in Ken Dan Tinio's house. */
export const KEN_HOUSEHOLD_CITIZENS = citizensWithHousehold().filter(
  (c) => c.householdEmail === KEN_HOUSEHOLD_EMAIL,
);

async function findUserUidByEmail(email: string): Promise<string | null> {
  const snap = await getDocs(
    query(
      collection(getClientDb(), "users"),
      where("email", "==", email.trim().toLowerCase()),
    ),
  );
  return snap.docs[0]?.id ?? null;
}

async function ensureCitizenAuthAndProfile(input: {
  email: string;
  password: string;
  displayName: string;
  purok: string;
  phone: string;
  householdId: string;
}): Promise<string> {
  const email = input.email.trim().toLowerCase();
  const existingUid = await findUserUidByEmail(email);
  if (existingUid) {
    await updateDoc(doc(getClientDb(), "users", existingUid), {
      displayName: input.displayName,
      purok: input.purok,
      phone: input.phone,
      role: "citizen",
      accountStatus: "active",
      barangay: "Nangka",
      lgu: "Consolacion",
      areaId: "consolacion/nangka",
      householdId: input.householdId,
      updatedAt: new Date().toISOString(),
      updatedAtServer: serverTimestamp(),
    });
    return existingUid;
  }

  const secondary = getSecondaryAuth();
  let uid: string;
  try {
    try {
      const cred = await createUserWithEmailAndPassword(
        secondary,
        email,
        input.password,
      );
      uid = cred.user.uid;
      await updateProfile(cred.user, { displayName: input.displayName });
    } catch (err) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: string }).code)
          : "";
      if (code !== "auth/email-already-in-use") throw err;
      const cred = await signInWithEmailAndPassword(
        secondary,
        email,
        input.password,
      );
      uid = cred.user.uid;
    }

    const now = new Date().toISOString();
    await setDoc(
      doc(getClientDb(), "users", uid),
      {
        uid,
        email,
        displayName: input.displayName,
        purok: input.purok,
        phone: input.phone,
        role: "citizen",
        createdAt: now,
        accountStatus: "active",
        barangay: "Nangka",
        lgu: "Consolacion",
        areaId: "consolacion/nangka",
        householdId: input.householdId,
        idVerified: DEMO_ID_PROOF.idVerified,
        idType: DEMO_ID_PROOF.idType,
        idConfidence: DEMO_ID_PROOF.idConfidence,
        idReason: DEMO_ID_PROOF.idReason,
        idSource: DEMO_ID_PROOF.idSource,
        idVerifiedAt: now,
        photoURL: null,
        idDocumentPath: null,
        faceDocumentPath: null,
        createdAtServer: serverTimestamp(),
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
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

async function householdDocsByEmail(email: string) {
  const snap = await getDocs(
    query(
      collection(getClientDb(), "households"),
      where("email", "==", email.trim().toLowerCase()),
    ),
  );
  return snap.docs;
}

/**
 * Link demo citizens whose `householdEmail` matches this house-owner email.
 */
async function ensureCitizensOnHouseholdEmail(
  householdEmail: string,
  citizens: HouseholdCitizen[],
): Promise<{ householdId: string | null; linked: number }> {
  const docs = await householdDocsByEmail(householdEmail);
  if (docs.length === 0) {
    return { householdId: null, linked: 0 };
  }

  const sorted = [...docs].sort((a, b) => {
    const la = Array.isArray(a.data().linkedCitizenUids)
      ? a.data().linkedCitizenUids.length
      : 0;
    const lb = Array.isArray(b.data().linkedCitizenUids)
      ? b.data().linkedCitizenUids.length
      : 0;
    return lb - la;
  });
  const householdIds = sorted.map((d) => d.id);
  const householdId = householdIds[0]!;
  const now = new Date().toISOString();

  let linked = 0;
  const citizenUids: string[] = [];
  for (const c of citizens) {
    const uid = await ensureCitizenAuthAndProfile({
      email: c.email,
      password: c.password,
      displayName: c.displayName,
      purok: c.purok,
      phone: c.phone,
      householdId,
    });
    citizenUids.push(uid);
  }

  // Owner email may already exist outside DEMO_CITIZENS password path.
  const ownerUid = await findUserUidByEmail(householdEmail);
  if (ownerUid && !citizenUids.includes(ownerUid)) {
    citizenUids.push(ownerUid);
    await updateDoc(doc(getClientDb(), "users", ownerUid), {
      householdId,
      role: "citizen",
      accountStatus: "active",
      barangay: "Nangka",
      lgu: "Consolacion",
      areaId: "consolacion/nangka",
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    });
  }

  for (const id of householdIds) {
    for (const uid of citizenUids) {
      await linkCitizenToHousehold(id, uid);
      linked += 1;
    }
  }

  const officerUids = new Set(
    docs.map((d) => String(d.data().officerUid ?? "")).filter(Boolean),
  );
  for (const officerUid of officerUids) {
    await dedupeHouseholdsByContact(officerUid);
  }

  return { householdId, linked };
}

/**
 * Ensure Ken + Jeanilou, Carl John Don, and Patricia are active citizen app
 * users linked to their curated Nangka house-owner households.
 */
export async function ensureKenHouseholdCitizens(): Promise<{
  householdId: string | null;
  linked: number;
}> {
  const byHousehold = new Map<string, HouseholdCitizen[]>();
  for (const c of citizensWithHousehold()) {
    const key = c.householdEmail.trim().toLowerCase();
    const list = byHousehold.get(key) ?? [];
    list.push(c);
    byHousehold.set(key, list);
  }

  // Ken house: keep members / notes / Jen email migration.
  const kenDocs = await householdDocsByEmail(KEN_HOUSEHOLD_EMAIL);
  if (kenDocs.length > 0) {
    const sorted = [...kenDocs].sort((a, b) => {
      const la = Array.isArray(a.data().linkedCitizenUids)
        ? a.data().linkedCitizenUids.length
        : 0;
      const lb = Array.isArray(b.data().linkedCitizenUids)
        ? b.data().linkedCitizenUids.length
        : 0;
      return lb - la;
    });
    const householdIds = sorted.map((d) => d.id);
    const householdId = householdIds[0]!;

    const JEANILOU_EMAIL = "jenlabajo.business@gmail.com";
    const JEANILOU_EMAIL_LEGACY = "jeanilou.labajo@nangka.citizen.demo";
    const members = [
      {
        name: "Jeanilou Labajo",
        email: JEANILOU_EMAIL,
        relation: "Partner",
      },
      {
        name: "Yumi",
        relation: "Dog",
      },
    ];
    const notes =
      "Citizen accounts · Ken + Jeanilou · Yumi (dog) · 2-storey · cemented all";
    const now = new Date().toISOString();

    for (const id of householdIds) {
      await updateDoc(doc(getClientDb(), "households", id), {
        members,
        notes,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      });
    }

    const legacyJenUid = await findUserUidByEmail(JEANILOU_EMAIL_LEGACY);
    if (legacyJenUid) {
      const already = await findUserUidByEmail(JEANILOU_EMAIL);
      if (!already) {
        await updateDoc(doc(getClientDb(), "users", legacyJenUid), {
          email: JEANILOU_EMAIL,
          displayName: "Jeanilou Labajo",
          householdId,
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
        });
      }
    }
  }

  let primaryHouseholdId: string | null = null;
  let linked = 0;
  for (const [householdEmail, citizens] of byHousehold) {
    const result = await ensureCitizensOnHouseholdEmail(
      householdEmail,
      citizens,
    );
    if (householdEmail === KEN_HOUSEHOLD_EMAIL) {
      primaryHouseholdId = result.householdId;
    } else if (!primaryHouseholdId) {
      primaryHouseholdId = result.householdId;
    }
    linked += result.linked;
  }

  return { householdId: primaryHouseholdId, linked };
}
