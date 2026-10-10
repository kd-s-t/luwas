import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { DEMO_ID_PROOF } from "@/lib/auth/demoAccount";
import { getClientDb } from "@/lib/firebase/client";

const AREA_ID = "consolacion/nangka";
const BARANGAY = "Nangka";
const LGU = "Consolacion";

type SamplePending =
  | {
      uid: string;
      role: "citizen";
      displayName: string;
      email: string;
      purok: string;
      phone: string;
    }
  | {
      uid: string;
      role: "officer";
      displayName: string;
      email: string;
      orgName: string;
      officerTitle: string;
      staffRank: string;
    };

/** Demo pending registrations for Account validation · Brgy. Nangka. */
export const PENDING_SAMPLE_ACCOUNTS: SamplePending[] = [
  {
    uid: "pending-sample-rosa-villanueva",
    role: "citizen",
    displayName: "Rosa Villanueva",
    email: "rosa.villanueva@nangka.pending.demo",
    purok: "Purok 2",
    phone: "+63 917 200 1001",
  },
  {
    uid: "pending-sample-miguel-santos",
    role: "citizen",
    displayName: "Miguel Santos",
    email: "miguel.santos@nangka.pending.demo",
    purok: "Purok 4",
    phone: "+63 917 200 1002",
  },
  {
    uid: "pending-sample-elena-cruz",
    role: "citizen",
    displayName: "Elena Cruz",
    email: "elena.cruz@nangka.pending.demo",
    purok: "Purok 1",
    phone: "+63 917 200 1003",
  },
  {
    uid: "pending-sample-rico-alonzo",
    role: "officer",
    displayName: "Rico Alonzo",
    email: "rico.alonzo@nangka.pending.demo",
    orgName: "Brgy. Nangka · Tanod",
    officerTitle: "Barangay Tanod",
    staffRank: "Tanod",
  },
  {
    uid: "pending-sample-sarah-lim",
    role: "officer",
    displayName: "Sarah Lim",
    email: "sarah.lim@nangka.pending.demo",
    orgName: "Brgy. Nangka · SK",
    officerTitle: "SK Councilor",
    staffRank: "SK",
  },
];

/**
 * Upsert 5 sample pending users into Firestore (idempotent).
 * Skips rows already approved / rejected / fired.
 */
export async function ensurePendingSampleAccounts(): Promise<{
  created: number;
  skipped: number;
}> {
  const db = getClientDb();
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const sample of PENDING_SAMPLE_ACCOUNTS) {
    const ref = doc(db, "users", sample.uid);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      const status = String(existing.data().accountStatus ?? "");
      if (status === "active" || status === "rejected" || status === "fired") {
        skipped += 1;
        continue;
      }
      if (status === "pending") {
        skipped += 1;
        continue;
      }
    }

    const idFields = {
      idVerified: DEMO_ID_PROOF.idVerified,
      idType: DEMO_ID_PROOF.idType,
      idConfidence: DEMO_ID_PROOF.idConfidence,
      idReason: DEMO_ID_PROOF.idReason,
      idSource: DEMO_ID_PROOF.idSource,
      idVerifiedAt: now,
      photoURL: null,
      idDocumentPath: null,
      faceDocumentPath: null,
    };

    if (sample.role === "citizen") {
      await setDoc(
        ref,
        {
          uid: sample.uid,
          email: sample.email,
          displayName: sample.displayName,
          role: "citizen",
          purok: sample.purok,
          phone: sample.phone,
          householdId: null,
          accountStatus: "pending",
          barangay: BARANGAY,
          lgu: LGU,
          areaId: AREA_ID,
          createdAt: now,
          createdAtServer: serverTimestamp(),
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
          ...idFields,
        },
        { merge: true },
      );
    } else {
      await setDoc(
        ref,
        {
          uid: sample.uid,
          email: sample.email,
          displayName: sample.displayName,
          role: "officer",
          orgName: sample.orgName,
          officerTitle: sample.officerTitle,
          staffRank: sample.staffRank,
          officerRank: "officer",
          activeBarangayId: null,
          accountStatus: "pending",
          barangay: BARANGAY,
          lgu: LGU,
          areaId: AREA_ID,
          createdAt: now,
          createdAtServer: serverTimestamp(),
          updatedAt: now,
          updatedAtServer: serverTimestamp(),
          employmentHistory: [],
          ...idFields,
        },
        { merge: true },
      );
    }
    created += 1;
  }

  return { created, skipped };
}
