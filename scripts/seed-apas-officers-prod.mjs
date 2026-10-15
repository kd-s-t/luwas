#!/usr/bin/env node
/**
 * Create / refresh Brgy. Apas officer Auth + Firestore users in production.
 *
 * Usage:
 *   node scripts/seed-apas-officers-prod.mjs
 *
 * Password for all demo logins: demo1234
 * Auth: gcloud user token + Firebase API key from .env.production
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "nice-pen-181017";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEMO_PASSWORD = "demo1234";
const AREA_ID = "cebu-city/apas";
const BARANGAY = "Apas";
const LGU = "Cebu City";
const ORG = "Brgy. Apas · Cebu City";
const STAFF_DOC_PREFIX = "cebu-city-apas";

const OFFICERS = [
  {
    id: "apas-captain",
    displayName: "Hon. Liza Padilla",
    title: "Punong Barangay",
    rank: "captain",
    reportsToId: null,
    email: "captain@apas.cebu.demo",
    phone: "09181234001",
    officerRank: "captain",
  },
  {
    id: "apas-secretary",
    displayName: "Nora Villamor",
    title: "Barangay Secretary",
    rank: "secretary",
    reportsToId: "apas-captain",
    email: "secretary@apas.cebu.demo",
    phone: "09181234002",
  },
  {
    id: "apas-treasurer",
    displayName: "Kevin Chua",
    title: "Barangay Treasurer",
    rank: "treasurer",
    reportsToId: "apas-captain",
    email: "treasurer@apas.cebu.demo",
    phone: "09181234003",
  },
  {
    id: "apas-kagawad-peace",
    displayName: "Roberto Alfaro",
    title: "Kagawad · Peace & Order",
    rank: "kagawad",
    reportsToId: "apas-captain",
    email: "kagawad.peace@apas.cebu.demo",
    phone: "09181234004",
  },
  {
    id: "apas-kagawad-health",
    displayName: "Diana Flores",
    title: "Kagawad · Health",
    rank: "kagawad",
    reportsToId: "apas-captain",
    email: "kagawad.health@apas.cebu.demo",
    phone: "09181234005",
  },
  {
    id: "apas-kagawad-infra",
    displayName: "Hector Bulan",
    title: "Kagawad · Infrastructure",
    rank: "kagawad",
    reportsToId: "apas-captain",
    email: "kagawad.infra@apas.cebu.demo",
    phone: "09181234006",
  },
  {
    id: "apas-sk",
    displayName: "Alyssa Remedio",
    title: "SK Chairperson",
    rank: "sk_chair",
    reportsToId: "apas-captain",
    email: "sk@apas.cebu.demo",
    phone: "09181234007",
  },
  {
    id: "apas-mdrrmo",
    displayName: "Samuel Rivera",
    title: "BDRRMC Coordinator · MDRRMO Focal",
    rank: "mdrrmo",
    reportsToId: "apas-captain",
    email: "mdrrmo@apas.cebu.demo",
    phone: "09181234008",
  },
  {
    id: "apas-rescue",
    displayName: "Leo Bantug",
    title: "Rescue Team Lead",
    rank: "staff",
    reportsToId: "apas-mdrrmo",
    email: "rescue@apas.cebu.demo",
    phone: "09181234009",
  },
  {
    id: "apas-radio",
    displayName: "Jenny Quijano",
    title: "Early Warning / Radio Net",
    rank: "staff",
    reportsToId: "apas-mdrrmo",
    email: "radio@apas.cebu.demo",
    phone: "09181234010",
  },
  {
    id: "apas-tanod-chief",
    displayName: "Cesar Abella",
    title: "Chief Tanod",
    rank: "tanod_chief",
    reportsToId: "apas-kagawad-peace",
    email: "tanod.chief@apas.cebu.demo",
    phone: "09181234011",
  },
  {
    id: "apas-tanod-1",
    displayName: "Ryan Cordova",
    title: "Barangay Tanod · Purok 1–3",
    rank: "tanod",
    reportsToId: "apas-tanod-chief",
    email: "tanod1@apas.cebu.demo",
    phone: "09181234012",
  },
  {
    id: "apas-tanod-2",
    displayName: "Paolo Ybanez",
    title: "Barangay Tanod · Purok 4–6",
    rank: "tanod",
    reportsToId: "apas-tanod-chief",
    email: "tanod2@apas.cebu.demo",
    phone: "09181234013",
  },
  {
    id: "apas-tanod-3",
    displayName: "Mark Osmeña",
    title: "Barangay Tanod · Night shift",
    rank: "tanod",
    reportsToId: "apas-tanod-chief",
    email: "tanod3@apas.cebu.demo",
    phone: "09181234014",
  },
  {
    id: "apas-bhw",
    displayName: "Teresa Magno",
    title: "Barangay Health Worker",
    rank: "bhw",
    reportsToId: "apas-kagawad-health",
    email: "bhw@apas.cebu.demo",
    phone: "09181234015",
  },
  {
    id: "apas-bhw-2",
    displayName: "Grace Aballe",
    title: "Barangay Health Worker · Senior care",
    rank: "bhw",
    reportsToId: "apas-kagawad-health",
    email: "bhw2@apas.cebu.demo",
    phone: "09181234016",
  },
];

function loadApiKey() {
  const envPath = join(ROOT, ".env.production");
  const text = readFileSync(envPath, "utf8");
  const m = text.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
  if (!m) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY in .env.production");
  return m[1].trim();
}

function token() {
  return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
}

function sv(s) {
  return { stringValue: s == null ? "" : String(s) };
}
function bv(b) {
  return { booleanValue: Boolean(b) };
}
function nullV() {
  return { nullValue: null };
}

function authHeaders(tok) {
  return {
    Authorization: `Bearer ${tok}`,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT,
  };
}

async function ensureAuthUser(apiKey, email, displayName) {
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        displayName,
        returnSecureToken: true,
      }),
    },
  );
  if (signUp.ok) {
    const data = await signUp.json();
    return { uid: data.localId, created: true };
  }
  const errText = await signUp.text();
  if (!/EMAIL_EXISTS/i.test(errText)) {
    throw new Error(`signUp ${email}: ${signUp.status} ${errText.slice(0, 200)}`);
  }
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: DEMO_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (!signIn.ok) {
    throw new Error(
      `signIn ${email}: ${signIn.status} ${await signIn.text().then((t) => t.slice(0, 200))}`,
    );
  }
  const data = await signIn.json();
  return { uid: data.localId, created: false };
}

async function findUidByEmail(tok, email) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(tok),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "email" },
            op: "EQUAL",
            value: sv(email),
          },
        },
        limit: 1,
      },
    }),
  });
  if (!res.ok) return null;
  const rows = await res.json();
  const name = rows?.[0]?.document?.name;
  if (!name) return null;
  return name.split("/").pop() ?? null;
}

async function upsertUserDoc(tok, uid, officer, hiredByUid, now) {
  const isCaptain = officer.officerRank === "captain" || officer.rank === "captain";
  const fields = {
    uid: sv(uid),
    email: sv(officer.email),
    displayName: sv(officer.displayName),
    role: sv("officer"),
    accountStatus: sv("active"),
    orgName: sv(
      isCaptain ? "Brgy. Apas · Punong Barangay" : `Brgy. Apas · ${officer.title}`,
    ),
    officerRank: sv(isCaptain ? "captain" : "officer"),
    officerTitle: sv(officer.title),
    staffId: sv(officer.id),
    reportsToStaffId: officer.reportsToId ? sv(officer.reportsToId) : nullV(),
    staffRank: sv(officer.rank),
    barangay: sv(BARANGAY),
    lgu: sv(LGU),
    areaId: sv(AREA_ID),
    activeBarangayId: sv(AREA_ID),
    idVerified: bv(true),
    idType: sv("demo"),
    idConfidence: { doubleValue: 0.99 },
    idReason: sv("Apas staff seed"),
    idSource: sv("local"),
    idVerifiedAt: sv(now),
    photoURL: sv(
      `https://i.pravatar.cc/128?u=${encodeURIComponent(officer.displayName)}`,
    ),
    hiredAt: sv(now),
    hiredByUid: sv(hiredByUid),
    createdAt: sv(now),
    updatedAt: sv(now),
  };
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?updateMask.fieldPaths=uid&updateMask.fieldPaths=email&updateMask.fieldPaths=displayName&updateMask.fieldPaths=role&updateMask.fieldPaths=accountStatus&updateMask.fieldPaths=orgName&updateMask.fieldPaths=officerRank&updateMask.fieldPaths=officerTitle&updateMask.fieldPaths=staffId&updateMask.fieldPaths=reportsToStaffId&updateMask.fieldPaths=staffRank&updateMask.fieldPaths=barangay&updateMask.fieldPaths=lgu&updateMask.fieldPaths=areaId&updateMask.fieldPaths=activeBarangayId&updateMask.fieldPaths=idVerified&updateMask.fieldPaths=idType&updateMask.fieldPaths=idConfidence&updateMask.fieldPaths=idReason&updateMask.fieldPaths=idSource&updateMask.fieldPaths=idVerifiedAt&updateMask.fieldPaths=photoURL&updateMask.fieldPaths=hiredAt&updateMask.fieldPaths=hiredByUid&updateMask.fieldPaths=updatedAt`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    // first write may need PATCH that creates — try without mask via documents:commit style create
    const createUrl =
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?documentId=${encodeURIComponent(uid)}`;
    const create = await fetch(createUrl, {
      method: "POST",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    });
    if (!create.ok && create.status !== 409) {
      throw new Error(
        `users/${uid}: ${res.status}/${create.status} ${(await create.text()).slice(0, 240)}`,
      );
    }
    if (create.status === 409) {
      const retry = await fetch(url, {
        method: "PATCH",
        headers: authHeaders(tok),
        body: JSON.stringify({ fields }),
      });
      if (!retry.ok) {
        throw new Error(`users/${uid} patch: ${retry.status} ${(await retry.text()).slice(0, 240)}`);
      }
    }
  }
}

async function upsertStaffDoc(tok, officer, now) {
  const docId = officer.id;
  const fields = {
    id: sv(officer.id),
    barangayId: sv(STAFF_DOC_PREFIX),
    displayName: sv(officer.displayName),
    title: sv(officer.title),
    rank: sv(officer.rank),
    scope: sv("barangay"),
    reportsToId: officer.reportsToId ? sv(officer.reportsToId) : nullV(),
    office: sv("Apas Barangay Hall"),
    phone: sv(officer.phone),
    email: sv(officer.email),
    accountEmail: sv(officer.email),
    status: sv("active"),
    orgName: sv(ORG),
    updatedAt: sv(now),
    createdAt: sv(now),
  };
  const patchUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/barangayStaff/${docId}?updateMask.fieldPaths=id&updateMask.fieldPaths=barangayId&updateMask.fieldPaths=displayName&updateMask.fieldPaths=title&updateMask.fieldPaths=rank&updateMask.fieldPaths=scope&updateMask.fieldPaths=reportsToId&updateMask.fieldPaths=office&updateMask.fieldPaths=phone&updateMask.fieldPaths=email&updateMask.fieldPaths=accountEmail&updateMask.fieldPaths=status&updateMask.fieldPaths=orgName&updateMask.fieldPaths=updatedAt`;
  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (res.ok) return;
  const createUrl =
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/barangayStaff?documentId=${encodeURIComponent(docId)}`;
  const create = await fetch(createUrl, {
    method: "POST",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (!create.ok && create.status !== 409) {
    console.warn(
      `staff ${docId}: ${create.status} ${(await create.text()).slice(0, 160)}`,
    );
  }
}

async function main() {
  const apiKey = loadApiKey();
  const tok = token();
  const now = new Date().toISOString();

  let hiredByUid =
    (await findUidByEmail(tok, "captain@apas.cebu.demo")) || "apas-seed";

  let created = 0;
  let updated = 0;
  const errors = [];

  for (const officer of OFFICERS) {
    try {
      let uid;
      try {
        const auth = await ensureAuthUser(
          apiKey,
          officer.email,
          officer.displayName,
        );
        uid = auth.uid;
        if (auth.created) created += 1;
        else updated += 1;
      } catch (err) {
        // Auth may already exist with different password — try Firestore lookup
        uid = await findUidByEmail(tok, officer.email);
        if (!uid) throw err;
        updated += 1;
      }
      if (officer.id === "apas-captain") hiredByUid = uid;
      await upsertUserDoc(tok, uid, officer, hiredByUid, now);
      await upsertStaffDoc(tok, officer, now);
      console.log(`ok ${officer.email} → ${uid}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${officer.email}: ${msg}`);
      console.error(`fail ${officer.email}: ${msg}`);
    }
  }

  console.log(
    JSON.stringify(
      {
        project: PROJECT,
        created,
        updated,
        total: OFFICERS.length,
        password: DEMO_PASSWORD,
        errors,
      },
      null,
      2,
    ),
  );
  if (errors.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
