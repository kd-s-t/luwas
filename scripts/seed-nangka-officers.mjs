#!/usr/bin/env node
/**
 * Create ALL Brgy. Nangka staff as officer app users (Auth + Firestore users/).
 * Fixes the Users pyramid stuck at captain + Maria only.
 *
 * Usage: node scripts/seed-nangka-officers.mjs
 */
import { initializeApp, deleteApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const [fsHost, fsPortStr] = FS_HOST.split(":");
const fsPort = Number(fsPortStr || 8080);
const PASSWORD = "demo1234";

const ID_PROOF = {
  idVerified: true,
  idType: "umid",
  idConfidence: 1,
  idReason: "Nangka staff seed",
  idSource: "local",
};

/** Full barangay working roster (same as lib/staff/nangkaStaff.ts). */
const STAFF = [
  {
    id: "captain",
    displayName: "Hon. Ricardo Villanueva",
    title: "Punong Barangay",
    rank: "captain",
    reportsToId: null,
    office: "Barangay Hall · Main",
    phone: "09171234001",
    email: "captain@nangka.consolacion.demo",
  },
  {
    id: "secretary",
    displayName: "Elena Ramos",
    title: "Barangay Secretary",
    rank: "secretary",
    reportsToId: "captain",
    office: "Barangay Hall · Records",
    phone: "09171234002",
    email: "secretary@nangka.consolacion.demo",
  },
  {
    id: "treasurer",
    displayName: "Benjamin Ong",
    title: "Barangay Treasurer",
    rank: "treasurer",
    reportsToId: "captain",
    office: "Barangay Hall · Finance",
    phone: "09171234003",
    email: "treasurer@nangka.consolacion.demo",
  },
  {
    id: "kagawad-peace",
    displayName: "Antonio Dela Peña",
    title: "Kagawad · Peace & Order",
    rank: "kagawad",
    reportsToId: "captain",
    office: "Barangay Hall",
    phone: "09171234004",
    email: "kagawad.peace@nangka.consolacion.demo",
  },
  {
    id: "kagawad-health",
    displayName: "Sofia Marquez",
    title: "Kagawad · Health",
    rank: "kagawad",
    reportsToId: "captain",
    office: "Barangay Health Station",
    phone: "09171234005",
    email: "kagawad.health@nangka.consolacion.demo",
  },
  {
    id: "kagawad-infra",
    displayName: "Paolo Gutierrez",
    title: "Kagawad · Infrastructure",
    rank: "kagawad",
    reportsToId: "captain",
    office: "Barangay Hall",
    phone: "09171234006",
    email: "kagawad.infra@nangka.consolacion.demo",
  },
  {
    id: "sk",
    displayName: "Mia Fernandez",
    title: "SK Chairperson",
    rank: "sk_chair",
    reportsToId: "captain",
    office: "SK Office",
    phone: "09171234007",
    email: "sk@nangka.consolacion.demo",
  },
  {
    id: "mdrrmo",
    displayName: "Maria Santos",
    title: "BDRRMC Coordinator · MDRRMO Focal",
    rank: "mdrrmo",
    reportsToId: "captain",
    office: "MDRRMO Desk · Barangay Hall",
    phone: "09171234008",
    email: "officer@nangka.consolacion.demo",
  },
  {
    id: "rescue-lead",
    displayName: "Joel Cabrera",
    title: "Rescue Team Lead",
    rank: "staff",
    reportsToId: "mdrrmo",
    office: "MDRRMO Desk",
    phone: "09171234009",
    email: "rescue@nangka.consolacion.demo",
  },
  {
    id: "ew-radio",
    displayName: "Gina Morales",
    title: "Early Warning / Radio Net",
    rank: "staff",
    reportsToId: "mdrrmo",
    office: "MDRRMO Desk",
    phone: "09171234010",
    email: "radio@nangka.consolacion.demo",
  },
  {
    id: "tanod-chief",
    displayName: "Ramon Sy",
    title: "Chief Tanod",
    rank: "tanod_chief",
    reportsToId: "kagawad-peace",
    office: "Tanod Outpost",
    phone: "09171234011",
    email: "tanod.chief@nangka.consolacion.demo",
  },
  {
    id: "tanod-1",
    displayName: "Mark Villar",
    title: "Barangay Tanod · Purok 1–3",
    rank: "tanod",
    reportsToId: "tanod-chief",
    office: "Tanod Outpost",
    phone: "09171234012",
    email: "tanod1@nangka.consolacion.demo",
  },
  {
    id: "tanod-2",
    displayName: "Eric Lim",
    title: "Barangay Tanod · Purok 4–6",
    rank: "tanod",
    reportsToId: "tanod-chief",
    office: "Tanod Outpost",
    phone: "09171234013",
    email: "tanod2@nangka.consolacion.demo",
  },
  {
    id: "bhw-1",
    displayName: "Rosa Castillo",
    title: "Barangay Health Worker",
    rank: "bhw",
    reportsToId: "kagawad-health",
    office: "Barangay Health Station",
    phone: "09171234014",
    email: "bhw@nangka.consolacion.demo",
  },
];

const cfg = {
  apiKey: "demo-api-key",
  projectId: PROJECT,
  authDomain: `${PROJECT}.firebaseapp.com`,
};

function pinFor(id) {
  const i = Math.abs([...id].reduce((a, c) => a + c.charCodeAt(0), 0));
  return {
    lat: 10.370744 + ((i % 17) - 8) * 0.00035,
    lng: 123.959104 + ((i % 13) - 6) * 0.0004,
  };
}

async function ensureAuth(auth, { email, password, displayName }) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
    return cred.user;
  } catch (err) {
    if (err?.code === "auth/email-already-in-use") {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    }
    throw err;
  }
}

async function upsertUserDoc(db, user, s) {
  const now = new Date().toISOString();
  const isCaptain = s.rank === "captain";
  await setDoc(
    doc(db, "users", user.uid),
    {
      uid: user.uid,
      email: s.email,
      displayName: s.displayName,
      orgName: isCaptain
        ? "Brgy. Nangka · Punong Barangay"
        : `Brgy. Nangka · ${s.title}`,
      role: "officer",
      createdAt: now,
      accountStatus: "active",
      officerRank: isCaptain ? "captain" : "officer",
      officerTitle: s.title,
      staffId: s.id,
      reportsToStaffId: s.reportsToId,
      staffRank: s.rank,
      barangay: "Nangka",
      lgu: "Consolacion",
      areaId: "consolacion/nangka",
      activeBarangayId: "consolacion/nangka",
      ...ID_PROOF,
      idVerifiedAt: now,
      updatedAt: now,
    },
    { merge: true },
  );
}

async function linkHouse(db, rosterUid, s, officerUid) {
  const email = s.email;
  const snap = await getDocs(
    query(collection(db, "households"), where("email", "==", email)),
  );
  const mine = snap.docs.find(
    (d) => String(d.data().officerUid ?? "") === rosterUid,
  );
  const pin = pinFor(s.id);
  const now = new Date().toISOString();
  const notes = `Officer residence · ${s.title}`;
  if (mine) {
    const linked = Array.isArray(mine.data().linkedOfficerUids)
      ? mine.data().linkedOfficerUids.map(String)
      : [];
    if (!linked.includes(officerUid)) linked.push(officerUid);
    await updateDoc(mine.ref, {
      ownerName: s.displayName,
      phone: s.phone,
      linkedOfficerUids: linked,
      notes,
      updatedAt: now,
    });
    return;
  }
  await addDoc(collection(db, "households"), {
    ownerName: s.displayName,
    address: `${s.office} · Brgy. Nangka`,
    purok: "Purok 1",
    phone: s.phone,
    email,
    notes,
    lat: pin.lat,
    lng: pin.lng,
    officerUid: rosterUid,
    orgName: "Brgy. Nangka MDRRMO",
    members: [],
    linkedCitizenUids: [],
    linkedOfficerUids: [officerUid],
    barangay: "Nangka",
    lgu: "Consolacion",
    createdAt: now,
    updatedAt: now,
  });
}

async function main() {
  console.log(`Seed Nangka officers · ${PROJECT}`);
  console.log(`Auth ${AUTH_HOST} · Firestore ${FS_HOST}`);

  const primary = initializeApp(cfg, "seed-primary");
  const auth = getAuth(primary);
  const db = getFirestore(primary);
  connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
  connectFirestoreEmulator(db, fsHost, fsPort);

  const secondary = initializeApp(cfg, "seed-secondary");
  const auth2 = getAuth(secondary);
  const db2 = getFirestore(secondary);
  connectAuthEmulator(auth2, `http://${AUTH_HOST}`, { disableWarnings: true });
  connectFirestoreEmulator(db2, fsHost, fsPort);

  // Primary stays as MDRRMO for household writes
  await signInWithEmailAndPassword(
    auth,
    "officer@nangka.consolacion.demo",
    PASSWORD,
  );
  const rosterUid = auth.currentUser.uid;
  console.log("roster officerUid", rosterUid);

  let ok = 0;
  const errors = [];
  for (const s of STAFF) {
    try {
      const user = await ensureAuth(auth2, {
        email: s.email,
        password: PASSWORD,
        displayName: s.displayName,
      });
      // Self-create/merge while signed in as that officer (rules allow)
      await upsertUserDoc(db2, user, s);
      await signOut(auth2);
      // Link house under MDRRMO roster (primary still Maria)
      await linkHouse(db, rosterUid, s, user.uid);
      ok += 1;
      console.log("ok", s.id, s.email, user.uid);
    } catch (err) {
      const msg = err?.message || String(err);
      errors.push(`${s.id}: ${msg}`);
      console.error("FAIL", s.id, msg);
      try {
        await signOut(auth2);
      } catch {
        /* ignore */
      }
    }
  }

  // Verify via Auth identity toolkit (Firestore list may be rule-gated)
  const authList = await fetch(
    `http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:query`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer owner",
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  ).then((r) => r.json());
  const staffEmails = new Set(STAFF.map((s) => s.email));
  const authStaff = (authList.userInfo || []).filter((u) =>
    staffEmails.has(u.email),
  );
  console.log(`\nAuth accounts matching staff: ${authStaff.length}/${STAFF.length}`);

  // Read each user doc as MDRRMO (can read all users)
  const officers = [];
  for (const s of STAFF) {
    const q = await getDocs(
      query(collection(db, "users"), where("email", "==", s.email)),
    );
    if (!q.empty) officers.push(q.docs[0].data());
  }
  console.log("\nDone.");
  console.log(`  seeded ${ok}/${STAFF.length}`);
  console.log(`  Nangka officers in Firestore: ${officers.length}`);
  for (const d of officers) {
    const x = d.data();
    console.log(
      `  - ${x.displayName} · ${x.staffRank || "?"} · ${x.email}`,
    );
  }
  if (errors.length) {
    console.log("\nErrors:");
    for (const e of errors) console.log(" ", e);
  }
  console.log("\nRefresh http://localhost:3000/command/users");
  console.log("Password for all: demo1234");

  await deleteApp(secondary);
  await deleteApp(primary);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
