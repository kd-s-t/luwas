#!/usr/bin/env node
/**
 * Seed Nangka officers via Auth + Firestore REST (Bearer owner bypasses rules).
 * Use when client seed fails or rules hit the 1000-expression limit.
 */
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
const AUTH = process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
const FS = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const PASSWORD = "demo1234";

const STAFF = [
  ["captain", "Hon. Ricardo Villanueva", "Punong Barangay", "captain", null, "09171234001", "captain@nangka.consolacion.demo"],
  ["secretary", "Elena Ramos", "Barangay Secretary", "secretary", "captain", "09171234002", "secretary@nangka.consolacion.demo"],
  ["treasurer", "Benjamin Ong", "Barangay Treasurer", "treasurer", "captain", "09171234003", "treasurer@nangka.consolacion.demo"],
  ["kagawad-peace", "Antonio Dela Peña", "Kagawad · Peace & Order", "kagawad", "captain", "09171234004", "kagawad.peace@nangka.consolacion.demo"],
  ["kagawad-health", "Sofia Marquez", "Kagawad · Health", "kagawad", "captain", "09171234005", "kagawad.health@nangka.consolacion.demo"],
  ["kagawad-infra", "Paolo Gutierrez", "Kagawad · Infrastructure", "kagawad", "captain", "09171234006", "kagawad.infra@nangka.consolacion.demo"],
  ["sk", "Mia Fernandez", "SK Chairperson", "sk_chair", "captain", "09171234007", "sk@nangka.consolacion.demo"],
  ["mdrrmo", "Maria Santos", "BDRRMC Coordinator · MDRRMO Focal", "mdrrmo", "captain", "09171234008", "officer@nangka.consolacion.demo"],
  ["rescue-lead", "Joel Cabrera", "Rescue Team Lead", "staff", "mdrrmo", "09171234009", "rescue@nangka.consolacion.demo"],
  ["ew-radio", "Gina Morales", "Early Warning / Radio Net", "staff", "mdrrmo", "09171234010", "radio@nangka.consolacion.demo"],
  ["tanod-chief", "Ramon Sy", "Chief Tanod", "tanod_chief", "kagawad-peace", "09171234011", "tanod.chief@nangka.consolacion.demo"],
  ["tanod-1", "Mark Villar", "Barangay Tanod · Purok 1–3", "tanod", "tanod-chief", "09171234012", "tanod1@nangka.consolacion.demo"],
  ["tanod-2", "Eric Lim", "Barangay Tanod · Purok 4–6", "tanod", "tanod-chief", "09171234013", "tanod2@nangka.consolacion.demo"],
  ["bhw-1", "Rosa Castillo", "Barangay Health Worker", "bhw", "kagawad-health", "09171234014", "bhw@nangka.consolacion.demo"],
];

function sv(s) {
  return { stringValue: s == null ? "" : String(s) };
}
function bv(b) {
  return { booleanValue: Boolean(b) };
}
function nv(n) {
  return { doubleValue: n };
}
function nullV() {
  return { nullValue: null };
}

async function ensureAuth(email, password, displayName) {
  const signUp = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
    },
  );
  if (signUp.ok) {
    const j = await signUp.json();
    return j.localId;
  }
  const signIn = await fetch(
    `http://${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  if (!signIn.ok) {
    throw new Error(`auth ${email}: ${await signIn.text()}`);
  }
  const j = await signIn.json();
  return j.localId;
}

async function putUser(uid, fields) {
  const url = `http://${FS}/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: "Bearer owner",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`firestore ${uid}: ${await res.text()}`);
}

async function main() {
  console.log("REST seed Nangka officers…");
  let ok = 0;
  for (const [id, displayName, title, rank, reportsToId, phone, email] of STAFF) {
    const uid = await ensureAuth(email, PASSWORD, displayName);
    const now = new Date().toISOString();
    const isCaptain = rank === "captain";
    await putUser(uid, {
      uid: sv(uid),
      email: sv(email),
      displayName: sv(displayName),
      orgName: sv(
        isCaptain
          ? "Brgy. Nangka · Punong Barangay"
          : `Brgy. Nangka · ${title}`,
      ),
      role: sv("officer"),
      createdAt: sv(now),
      accountStatus: sv("active"),
      officerRank: sv(isCaptain ? "captain" : "officer"),
      officerTitle: sv(title),
      staffId: sv(id),
      reportsToStaffId: reportsToId ? sv(reportsToId) : nullV(),
      staffRank: sv(rank),
      barangay: sv("Nangka"),
      lgu: sv("Consolacion"),
      areaId: sv("consolacion/nangka"),
      activeBarangayId: sv("consolacion/nangka"),
      idVerified: bv(true),
      idType: sv("umid"),
      idConfidence: nv(1),
      idReason: sv("Nangka staff REST seed"),
      idSource: sv("local"),
      idVerifiedAt: sv(now),
      updatedAt: sv(now),
      phone: sv(phone),
    });
    ok += 1;
    console.log("ok", id, email, uid);
  }
  console.log(`\nDone · ${ok}/${STAFF.length} officers`);
  console.log("Refresh /command/users — password demo1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
