#!/usr/bin/env node
/**
 * Seed functional demo data into the local Firebase emulators (Auth + Firestore).
 * Usage: node scripts/seed-local.mjs
 * Requires emulators on :9099 (Auth) and :8080 (Firestore).
 */
import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const [fsHost, fsPortStr] = FS_HOST.split(":");
const fsPort = Number(fsPortStr || 8080);

const ID_PROOF = {
  idVerified: true,
  idType: "umid",
  idConfidence: 1,
  idReason: "Demo emulator bootstrap — not a production ID check.",
  idSource: "local",
};

const OFFICERS = [
  {
    displayName: "Hon. Ricardo Villanueva",
    orgName: "Brgy. Nangka · Punong Barangay",
    email: "captain@nangka.consolacion.demo",
    password: "demo1234",
  },
  {
    displayName: "Maria Santos",
    orgName: "Brgy. Nangka MDRRMO",
    email: "officer@nangka.consolacion.demo",
    password: "demo1234",
  },
  {
    displayName: "Atty. Carla Mendoza",
    orgName: "Consolacion MDRRMO",
    email: "lgu@consolacion.demo",
    password: "demo1234",
  },
];

const CITIZENS = [
  {
    displayName: "Juan Dela Cruz",
    email: "juan.delacruz@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 1",
    phone: "+63 917 100 0001",
  },
  {
    displayName: "Ana Reyes",
    email: "ana.reyes@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 2",
    phone: "+63 917 100 0002",
  },
  {
    displayName: "Carlo Bautista",
    email: "carlo.bautista@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 3",
    phone: "+63 917 100 0003",
  },
  {
    displayName: "Liza Mendez",
    email: "liza.mendez@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 4",
    phone: "+63 917 100 0004",
  },
  {
    displayName: "Marco Tan",
    email: "marco.tan@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 5",
    phone: "+63 917 100 0005",
  },
  {
    displayName: "Ken Dan S. Tinio",
    email: "kendantinio@gmail.com",
    password: "demo1234",
    purok: "Purok 6",
    phone: "09606075119",
  },
];

const REPORT_PINS = [
  {
    id: "rpt-block-access-east",
    title: "Road blocked · fallen tree",
    hazardHint: "typhoon",
    lat: 10.3686,
    lng: 123.9658,
    purok: "Purok 6",
    name: "Marco Tan",
    notes: "Tree across both lanes · no through traffic",
    reportedAt: "2026-10-08T01:45:00+08:00",
    mediaUrl: "/reports/road-block-access-east.jpg",
  },
  {
    id: "rpt-block-singko",
    title: "Fallen tree · Access Road",
    hazardHint: "typhoon",
    lat: 10.3704,
    lng: 123.9629,
    purok: "Purok 4",
    name: "Liza Mendez",
    notes: "Tree across both lanes · motorcycle only",
    reportedAt: "2026-10-08T01:20:00+08:00",
    mediaUrl: "/reports/fallen-tree-access-road.webp",
  },
  {
    id: "rpt-flood-chapel",
    title: "Flood road · chapel approach",
    hazardHint: "flood",
    lat: 10.3712,
    lng: 123.9594,
    purok: "Purok 4",
    name: "Liza Mendez",
    notes: "Flash flood across both lanes · road impassable",
    reportedAt: "2026-10-08T00:55:00+08:00",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "rpt-landslide-east-bank",
    title: "Landslide · bank failure",
    hazardHint: "landslide",
    lat: 10.3682,
    lng: 123.9664,
    purok: "Purok 6",
    name: "Ken Dan S. Tinio",
    notes: "Bank undercut · flood + slide compound risk",
    reportedAt: "2026-10-07T11:05:00+08:00",
    mediaUrl: "/reports/landslide-bank-failure.png",
  },
  {
    id: "rpt-landslide-cansaga",
    title: "Landslide · debris slide",
    hazardHint: "landslide",
    lat: 10.3742,
    lng: 123.9562,
    purok: "Purok 2",
    name: "Ana Reyes",
    notes: "Mud/debris reached lane · 2 houses advised to evacuate to hall",
    reportedAt: "2026-10-07T05:15:00+08:00",
    mediaUrl: "/reports/landslide-bank-failure.png",
  },
  {
    id: "rpt-help-purok1",
    title: "Need help · stranded family",
    hazardHint: "flood",
    lat: 10.3708,
    lng: 123.9592,
    purok: "Purok 1",
    name: "Juan Dela Cruz",
    notes: "Water rising · elderly parent cannot walk · need rescue boat",
    reportedAt: "2026-10-09T22:10:00+08:00",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
];

const HOUSEHOLDS = [
  {
    ownerName: "Jose Reyes",
    address: "Near Nangka Barangay Hall, Purok 1–6 Access Road",
    purok: "Purok 1",
    phone: "09171234501",
    email: "jose.reyes@nangka.consolacion.demo",
    notes: "Barangay tanod · 5 household members",
    lat: 10.370744,
    lng: 123.959104,
  },
  {
    ownerName: "Ana Cruz",
    address: "Beside Sto. Niño Chapel, Access Road",
    purok: "Purok 1",
    phone: "09181234502",
    email: "ana.cruz@nangka.consolacion.demo",
    notes: "Elderly mother in care · needs meds check",
    lat: 10.3710086,
    lng: 123.9593892,
  },
  {
    ownerName: "Roberto Dela Cruz",
    address: "Purok 1–6 Access Road, east of hall",
    purok: "Purok 2",
    phone: "09201234503",
    email: "",
    notes: "Flood-prone low lot · single-storey",
    lat: 10.37025,
    lng: 123.960595,
  },
  {
    ownerName: "Liza Mendoza",
    address: "Access Road near drainage canal",
    purok: "Purok 2",
    phone: "09191234504",
    email: "liza.mendoza@nangka.consolacion.demo",
    notes: "PWD household member · wheelchair",
    lat: 10.370116,
    lng: 123.961193,
  },
  {
    ownerName: "Carlos Villanueva",
    address: "Near Nangka Elementary School, Purok Uno",
    purok: "Purok 3",
    phone: "09171234505",
    email: "cvillanueva@nangka.consolacion.demo",
    notes: "2-storey · can host nearby evacuees",
    lat: 10.3721058,
    lng: 123.9590862,
  },
  {
    ownerName: "Elena Bautista",
    address: "Purok Uno residential lane, north of school",
    purok: "Purok 3",
    phone: "09221234506",
    email: "",
    notes: "Infant in household · formula stock needed",
    lat: 10.37245,
    lng: 123.95955,
  },
  {
    ownerName: "Miguel Santos",
    address: "Purok Singko stretch, Access Road",
    purok: "Purok 4",
    phone: "09181234507",
    email: "miguel.santos@nangka.consolacion.demo",
    notes: "Vendor · store on ground floor",
    lat: 10.370511,
    lng: 123.96276,
  },
  {
    ownerName: "Rosa Aquino",
    address: "Near Holy Family Chapel, Tomas P. Go Road",
    purok: "Purok 4",
    phone: "09191234508",
    email: "rosa.aquino@nangka.consolacion.demo",
    notes: "Pregnant · priority evacuation",
    lat: 10.3685131,
    lng: 123.9617722,
  },
  {
    ownerName: "Daniel Garcia",
    address: "Purok Singko, mid Access Road",
    purok: "Purok 5",
    phone: "09201234509",
    email: "",
    notes: "Generator available · neighborhood hub",
    lat: 10.370266,
    lng: 123.963364,
  },
  {
    ownerName: "Sofia Navarro",
    address: "Purok Singko east lane",
    purok: "Purok 5",
    phone: "09171234510",
    email: "sofia.navarro@nangka.consolacion.demo",
    notes: "Rents out ground floor store",
    lat: 10.370037,
    lng: 123.964048,
  },
  {
    ownerName: "Antonio Ramos",
    address: "Low stretch, eastern Access Road",
    purok: "Purok 6",
    phone: "09181234511",
    email: "",
    notes: "High flood risk · no upper floor",
    lat: 10.368998,
    lng: 123.965451,
  },
  {
    ownerName: "Grace Lim",
    address: "End of Purok 1–6 Access Road (east)",
    purok: "Purok 6",
    phone: "09221234512",
    email: "grace.lim@nangka.consolacion.demo",
    notes: "School teacher · 3 children",
    lat: 10.36822,
    lng: 123.96555,
  },
  {
    ownerName: "Juan Dela Cruz",
    address: "Purok 1 · near Barangay Hall",
    purok: "Purok 1",
    phone: "+63 917 100 0001",
    email: "juan.delacruz@nangka.citizen.demo",
    notes: "Citizen account · 4 household members",
    lat: 10.3709,
    lng: 123.9593,
  },
  {
    ownerName: "Ken Dan S. Tinio",
    address: "Purok 6 · eastern Access Road (Cansaga corridor)",
    purok: "Purok 6",
    phone: "09606075119",
    email: "kendantinio@gmail.com",
    notes:
      "Citizen account · 2 people · 1 dog · 2-storey · cemented all · home pin verified",
    lat: 10.369166,
    lng: 123.962317,
  },
];

const STAFF = [
  {
    id: "captain",
    displayName: "Hon. Ricardo Villanueva",
    title: "Punong Barangay",
    rank: "captain",
    scope: "barangay",
    reportsToId: null,
    office: "Barangay Hall · Main",
    phone: "09171234001",
    email: "captain@nangka.consolacion.demo",
    accountEmail: "captain@nangka.consolacion.demo",
    status: "active",
    notes: "Overall command · DRRM policy · evacuation orders",
  },
  {
    id: "mdrrmo",
    displayName: "Maria Santos",
    title: "BDRRMC Coordinator · MDRRMO Focal",
    rank: "mdrrmo",
    scope: "barangay",
    reportsToId: "captain",
    office: "MDRRMO Desk · Barangay Hall",
    phone: "09171234008",
    email: "officer@nangka.consolacion.demo",
    accountEmail: "officer@nangka.consolacion.demo",
    status: "active",
    notes: "Ops map · triage · SMS/email alerts",
  },
  {
    id: "lgu-mdrrmo",
    displayName: "Atty. Carla Mendoza",
    title: "Consolacion MDRRMO · Municipal Officer",
    rank: "lgu_director",
    scope: "lgu",
    reportsToId: null,
    office: "Consolacion Municipal Hall · MDRRMO",
    phone: "09171234901",
    email: "lgu@consolacion.demo",
    accountEmail: "lgu@consolacion.demo",
    status: "active",
    notes: "LGU oversight · resource request",
  },
  {
    id: "rescue-lead",
    displayName: "Joel Cabrera",
    title: "Rescue Team Lead",
    rank: "staff",
    scope: "barangay",
    reportsToId: "mdrrmo",
    office: "MDRRMO Desk",
    phone: "09171234009",
    email: "rescue@nangka.consolacion.demo",
    status: "active",
  },
  {
    id: "tanod-chief",
    displayName: "Ramon Sy",
    title: "Chief Tanod",
    rank: "tanod_chief",
    scope: "barangay",
    reportsToId: "captain",
    office: "Tanod Outpost",
    phone: "09171234011",
    email: "tanod.chief@nangka.consolacion.demo",
    status: "active",
  },
  {
    id: "bhw-1",
    displayName: "Rosa Castillo",
    title: "Barangay Health Worker",
    rank: "bhw",
    scope: "barangay",
    reportsToId: "captain",
    office: "Barangay Health Station",
    phone: "09171234014",
    email: "bhw@nangka.consolacion.demo",
    status: "active",
  },
];

const app = initializeApp({
  apiKey: "demo-api-key",
  projectId: PROJECT,
  authDomain: `${PROJECT}.firebaseapp.com`,
});
const auth = getAuth(app);
const db = getFirestore(app);
connectAuthEmulator(auth, `http://${AUTH_HOST}`, { disableWarnings: true });
connectFirestoreEmulator(db, fsHost, fsPort);

async function ensureAuthUser({ email, password, displayName }) {
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

async function seedUsers() {
  const now = new Date().toISOString();
  const uids = { officers: {}, citizens: {} };

  for (const o of OFFICERS) {
    const user = await ensureAuthUser(o);
    const ref = doc(db, "users", user.uid);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: o.email,
        displayName: o.displayName,
        orgName: o.orgName,
        role: "officer",
        createdAt: now,
        ...ID_PROOF,
      });
    }
    uids.officers[o.email] = user.uid;
    console.log("user/officer", o.email, user.uid);
  }

  for (const c of CITIZENS) {
    const user = await ensureAuthUser(c);
    const ref = doc(db, "users", user.uid);
    if (!(await getDoc(ref)).exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email: c.email,
        displayName: c.displayName,
        purok: c.purok,
        phone: c.phone,
        role: "citizen",
        createdAt: now,
        ...ID_PROOF,
      });
    }
    uids.citizens[c.email] = user.uid;
    console.log("user/citizen", c.email, user.uid);
  }

  return uids;
}

async function seedReports() {
  const now = new Date().toISOString();
  let n = 0;
  for (const pin of REPORT_PINS) {
    const mime = pin.mediaUrl.endsWith(".png")
      ? "image/png"
      : pin.mediaUrl.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";
    await setDoc(doc(db, "reports", pin.id), {
      citizenUid: "demo-map-seed",
      citizenName: pin.name,
      citizenPurok: pin.purok,
      barangay: "Nangka",
      lgu: "Consolacion",
      citizenPhotoURL: null,
      title: pin.title,
      notes: pin.notes,
      hazardHint: pin.hazardHint,
      mediaType: "photo",
      mediaPath: pin.mediaUrl,
      mediaUrl: pin.mediaUrl,
      mediaMime: mime,
      mediaSource: "mobile-camera",
      lat: pin.lat,
      lng: pin.lng,
      locationAccuracyM: null,
      locationLabel: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
      device: "Android · mobile",
      ipAddress: null,
      status: "legit",
      aiVerdict: "legit",
      aiConfidence: 0.92,
      aiReason: "Seeded functional local data",
      aiSource: "local",
      aiModel: null,
      validatedAt: pin.reportedAt,
      reactionCounts: { like: 2, helpful: 1, concern: 0 },
      commentCount: 0,
      createdAt: pin.reportedAt,
      updatedAt: now,
    });
    n += 1;
    console.log("report", pin.id);
  }
  return n;
}

async function seedHouseholds(officerUid, orgName) {
  const q = query(
    collection(db, "households"),
    where("officerUid", "==", officerUid),
  );
  const existing = await getDocs(q);
  if (!existing.empty) {
    let batch = writeBatch(db);
    let i = 0;
    for (const d of existing.docs) {
      batch.delete(d.ref);
      i += 1;
      if (i % 400 === 0) {
        await batch.commit();
        batch = writeBatch(db);
      }
    }
    if (i % 400 !== 0) await batch.commit();
    console.log("cleared households", i);
  }

  const now = new Date().toISOString();
  let batch = writeBatch(db);
  let n = 0;
  for (const h of HOUSEHOLDS) {
    const ref = doc(collection(db, "households"));
    batch.set(ref, {
      ...h,
      officerUid,
      orgName,
      createdAt: now,
      updatedAt: now,
    });
    n += 1;
  }
  await batch.commit();
  console.log("households", n, "for", officerUid);
  return n;
}

async function seedStaff() {
  const now = new Date().toISOString();
  const barangayId = "nangka-consolacion";
  const orgName = "Brgy. Nangka · Consolacion, Cebu";
  let n = 0;
  for (const s of STAFF) {
    await setDoc(doc(db, "barangayStaff", s.id), {
      ...s,
      barangayId,
      orgName,
      createdAt: now,
      updatedAt: now,
    });
    n += 1;
    console.log("staff", s.id);
  }
  return n;
}

async function main() {
  console.log(`Seeding local Luwas DB · project=${PROJECT}`);
  console.log(`Auth ${AUTH_HOST} · Firestore ${FS_HOST}`);

  const uids = await seedUsers();
  const officerUid = uids.officers["officer@nangka.consolacion.demo"];
  if (!officerUid) throw new Error("Missing MDRRMO officer uid");

  // Sign in as officer for rule-gated writes
  await signInWithEmailAndPassword(
    auth,
    "officer@nangka.consolacion.demo",
    "demo1234",
  );

  const reports = await seedReports();
  const households = await seedHouseholds(officerUid, "Brgy. Nangka MDRRMO");
  const staff = await seedStaff();

  console.log("\nDone · functional local data:");
  console.log(`  officers ${OFFICERS.length} · citizens ${CITIZENS.length}`);
  console.log(`  reports ${reports} · households ${households} · staff ${staff}`);
  console.log("\nLogin (password demo1234):");
  console.log("  officer@nangka.consolacion.demo");
  console.log("  juan.delacruz@nangka.citizen.demo");
  console.log(`  Emulator UI http://127.0.0.1:4000/`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
