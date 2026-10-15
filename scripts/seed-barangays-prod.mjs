#!/usr/bin/env node
/**
 * Populate demo ops data for named barangays in production.
 * Skips areas that already have staff. Resolves unknown names to nearest known hall.
 *
 * Usage: node scripts/seed-barangays-prod.mjs
 * Password for new officer logins: demo1234
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
const MIN_STAFF_TO_SKIP = 6;

/** Requested labels → preferred resolved area (lgu + barangay). */
const REQUESTS = [
  { label: "Apas", lgu: "Cebu City", barangay: "Apas" },
  { label: "Talisay", lgu: "Talisay", barangay: "Poblacion" },
  { label: "Pardo", lgu: "Cebu City", barangay: "Pardo" },
  { label: "Talamban", lgu: "Cebu City", barangay: "Talamban" },
  { label: "Nangka", lgu: "Consolacion", barangay: "Nangka" },
  { label: "Consolacion", lgu: "Consolacion", barangay: "Poblacion Occidental" },
];

const STAFF_TEMPLATE = [
  {
    baseId: "captain",
    displayName: "Hon. Capitan Demo",
    title: "Punong Barangay",
    rank: "captain",
    reportsToBase: null,
    phoneSuffix: "01",
  },
  {
    baseId: "secretary",
    displayName: "Secretary Demo",
    title: "Barangay Secretary",
    rank: "secretary",
    reportsToBase: "captain",
    phoneSuffix: "02",
  },
  {
    baseId: "treasurer",
    displayName: "Treasurer Demo",
    title: "Barangay Treasurer",
    rank: "treasurer",
    reportsToBase: "captain",
    phoneSuffix: "03",
  },
  {
    baseId: "kagawad-peace",
    displayName: "Kagawad Peace Demo",
    title: "Kagawad · Peace & Order",
    rank: "kagawad",
    reportsToBase: "captain",
    phoneSuffix: "04",
  },
  {
    baseId: "mdrrmo",
    displayName: "MDRRMO Focal Demo",
    title: "BDRRMC Coordinator · MDRRMO Focal",
    rank: "mdrrmo",
    reportsToBase: "captain",
    phoneSuffix: "05",
  },
  {
    baseId: "tanod-chief",
    displayName: "Chief Tanod Demo",
    title: "Chief Tanod",
    rank: "tanod_chief",
    reportsToBase: "kagawad-peace",
    phoneSuffix: "06",
  },
  {
    baseId: "tanod-1",
    displayName: "Tanod Demo 1",
    title: "Barangay Tanod · Day",
    rank: "tanod",
    reportsToBase: "tanod-chief",
    phoneSuffix: "07",
  },
  {
    baseId: "bhw",
    displayName: "BHW Demo",
    title: "Barangay Health Worker",
    rank: "bhw",
    reportsToBase: "captain",
    phoneSuffix: "08",
  },
];

/** Prefer known names for Apas / Nangka (already seeded with real demo identities). */
const SPECIAL = {
  "cebu-city/apas": "apas",
  "consolacion/nangka": "nangka",
};

const KNOWN_CENTERS = {
  "consolacion/nangka": { lat: 10.370744, lng: 123.959104 },
  "consolacion/poblacion-occidental": { lat: 10.3768, lng: 123.9571 },
  "cebu-city/apas": { lat: 10.337229, lng: 123.90484 },
  "cebu-city/pardo": { lat: 10.2945, lng: 123.8552 },
  "cebu-city/talamban": { lat: 10.3702, lng: 123.9148 },
  "talisay/poblacion": { lat: 10.2447, lng: 123.8494 },
  "cebu-city/lahug": { lat: 10.3356, lng: 123.8942 },
  "cebu-city/mabolo": { lat: 10.3275, lng: 123.9158 },
};

function slugify(s) {
  return String(s)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function mapAreaId(lgu, barangay) {
  return `${slugify(lgu)}/${slugify(barangay)}`;
}

function loadApiKey() {
  const text = readFileSync(join(ROOT, ".env.production"), "utf8");
  const m = text.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
  if (!m) throw new Error("Missing NEXT_PUBLIC_FIREBASE_API_KEY");
  return m[1].trim();
}

function token() {
  return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
}

function authHeaders(tok) {
  return {
    Authorization: `Bearer ${tok}`,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT,
  };
}

function sv(s) {
  return { stringValue: s == null ? "" : String(s) };
}
function bv(b) {
  return { booleanValue: Boolean(b) };
}
function nv(n) {
  return { doubleValue: Number(n) };
}
function nullV() {
  return { nullValue: null };
}

function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function resolveArea(req) {
  const id = mapAreaId(req.lgu, req.barangay);
  const center = KNOWN_CENTERS[id];
  if (center) {
    return {
      id,
      barangay: req.barangay,
      lgu: req.lgu,
      center,
      resolvedFrom: req.label,
      via: "exact",
    };
  }
  // Nearest known center to LGU fallback guess
  const guess =
    KNOWN_CENTERS[`${slugify(req.lgu)}/poblacion`] ||
    KNOWN_CENTERS[`${slugify(req.lgu)}/nangka`] ||
    { lat: 10.3157, lng: 123.8854 };
  let best = null;
  let bestKm = 40;
  for (const [kid, c] of Object.entries(KNOWN_CENTERS)) {
    const km = haversineKm(guess, c);
    if (km < bestKm) {
      bestKm = km;
      const [lguSlug, brgySlug] = kid.split("/");
      best = {
        id: kid,
        barangay: brgySlug
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
        lgu: req.lgu,
        center: c,
        resolvedFrom: req.label,
        via: `nearest (${bestKm.toFixed(1)}km → ${kid})`,
      };
    }
  }
  if (!best) throw new Error(`Cannot resolve ${req.label}`);
  // Prefer keeping requested barangay name when id was built from request
  if (!KNOWN_CENTERS[id]) {
    return {
      ...best,
      // keep synthetic id for staff namespace uniqueness when dropping on nearest
      seedId: best.id,
      requestedId: id,
    };
  }
  return best;
}

async function countStaff(tok, barangayDocId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(tok),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "barangayStaff" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "barangayId" },
            op: "EQUAL",
            value: sv(barangayDocId),
          },
        },
        limit: 20,
      },
    }),
  });
  if (!res.ok) throw new Error(`staff query: ${res.status}`);
  const rows = await res.json();
  return rows.filter((r) => r.document).length;
}

async function countOfficersByArea(tok, areaId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(tok),
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "users" }],
        where: {
          compositeFilter: {
            op: "AND",
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: "role" },
                  op: "EQUAL",
                  value: sv("officer"),
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: "areaId" },
                  op: "EQUAL",
                  value: sv(areaId),
                },
              },
            ],
          },
        },
        limit: 30,
      },
    }),
  });
  if (!res.ok) return 0;
  const rows = await res.json();
  return rows.filter((r) => r.document).length;
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
    throw new Error(`signUp ${email}: ${signUp.status} ${errText.slice(0, 180)}`);
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
    throw new Error(`signIn ${email}: ${signIn.status}`);
  }
  const data = await signIn.json();
  return { uid: data.localId, created: false };
}

async function patchDoc(tok, path, fields, fieldPaths) {
  const mask = fieldPaths
    .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${path}?${mask}`;
  let res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (res.ok) return;
  const parts = path.split("/");
  const docId = parts.pop();
  const parent = parts.join("/");
  const create = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${parent}?documentId=${encodeURIComponent(docId)}`,
    {
      method: "POST",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    },
  );
  if (!create.ok && create.status !== 409) {
    throw new Error(`${path}: ${create.status} ${(await create.text()).slice(0, 200)}`);
  }
  if (create.status === 409) {
    res = await fetch(url, {
      method: "PATCH",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) {
      throw new Error(`${path} retry: ${res.status}`);
    }
  }
}

function buildStaff(area) {
  const prefix = area.id.replace(/\//g, "-");
  const domain = `${area.id.replace(/\//g, ".")}.demo`;
  const code = Math.abs(
    [...area.id].reduce((a, c) => a + c.charCodeAt(0), 0),
  )
    .toString()
    .slice(0, 4);
  return STAFF_TEMPLATE.map((t) => {
    const id = `${prefix}__${t.baseId}`;
    const emailLocal = t.baseId.replace(/-/g, ".");
    return {
      id,
      displayName:
        t.rank === "captain"
          ? `Hon. ${area.barangay} Captain`
          : `${t.displayName.replace("Demo", area.barangay)}`,
      title: t.title,
      rank: t.rank,
      reportsToId: t.reportsToBase ? `${prefix}__${t.reportsToBase}` : null,
      email: `${emailLocal}@${domain}`,
      phone: `0918${code}${t.phoneSuffix}`.slice(0, 11),
      officerRank: t.rank === "captain" ? "captain" : "officer",
    };
  });
}

async function seedArea(tok, apiKey, area) {
  const barangayDocId = area.id.replace(/\//g, "-");
  const orgName = `Brgy. ${area.barangay} · ${area.lgu}`;
  const now = new Date().toISOString();
  const staff = buildStaff(area);
  let hiredByUid = "barangay-seed";
  const createdUids = [];

  for (const member of staff) {
    const auth = await ensureAuthUser(apiKey, member.email, member.displayName);
    if (member.rank === "captain") hiredByUid = auth.uid;
    createdUids.push(auth.uid);

    await patchDoc(
      tok,
      `users/${auth.uid}`,
      {
        uid: sv(auth.uid),
        email: sv(member.email),
        displayName: sv(member.displayName),
        role: sv("officer"),
        accountStatus: sv("active"),
        orgName: sv(
          member.rank === "captain"
            ? `Brgy. ${area.barangay} · Punong Barangay`
            : `Brgy. ${area.barangay} · ${member.title}`,
        ),
        officerRank: sv(member.officerRank),
        officerTitle: sv(member.title),
        staffId: sv(member.id),
        reportsToStaffId: member.reportsToId
          ? sv(member.reportsToId)
          : nullV(),
        staffRank: sv(member.rank),
        barangay: sv(area.barangay),
        lgu: sv(area.lgu),
        areaId: sv(area.id),
        activeBarangayId: sv(area.id),
        phone: sv(member.phone),
        idVerified: bv(true),
        idType: sv("demo"),
        idConfidence: nv(0.99),
        idReason: sv("Barangay ops seed"),
        idSource: sv("local"),
        idVerifiedAt: sv(now),
        photoURL: sv(
          `https://i.pravatar.cc/128?u=${encodeURIComponent(member.displayName)}`,
        ),
        hiredAt: sv(now),
        hiredByUid: sv(hiredByUid),
        createdAt: sv(now),
        updatedAt: sv(now),
      },
      [
        "uid",
        "email",
        "displayName",
        "role",
        "accountStatus",
        "orgName",
        "officerRank",
        "officerTitle",
        "staffId",
        "reportsToStaffId",
        "staffRank",
        "barangay",
        "lgu",
        "areaId",
        "activeBarangayId",
        "phone",
        "idVerified",
        "updatedAt",
      ],
    );

    await patchDoc(
      tok,
      `barangayStaff/${member.id}`,
      {
        id: sv(member.id),
        barangayId: sv(barangayDocId),
        orgName: sv(orgName),
        displayName: sv(member.displayName),
        title: sv(member.title),
        rank: sv(member.rank),
        scope: sv("barangay"),
        reportsToId: member.reportsToId ? sv(member.reportsToId) : nullV(),
        office: sv(`${area.barangay} Barangay Hall`),
        phone: sv(member.phone),
        email: sv(member.email),
        accountEmail: sv(member.email),
        status: sv("active"),
        updatedAt: sv(now),
        createdAt: sv(now),
      },
      [
        "id",
        "barangayId",
        "orgName",
        "displayName",
        "title",
        "rank",
        "scope",
        "reportsToId",
        "office",
        "phone",
        "email",
        "accountEmail",
        "status",
        "updatedAt",
      ],
    );
  }

  // Demo households around hall (attached to captain)
  const captainUid = hiredByUid;
  for (let i = 0; i < 12; i++) {
    const ang = (i / 12) * Math.PI * 2;
    const dist = 0.0005 + (i % 5) * 0.0004;
    const lat = area.center.lat + Math.cos(ang) * dist;
    const lng = area.center.lng + Math.sin(ang) * dist;
    const docId = `${barangayDocId}-hh-${String(i + 1).padStart(2, "0")}`;
    await patchDoc(
      tok,
      `households/${docId}`,
      {
        ownerName: sv(`Household ${i + 1} · ${area.barangay}`),
        address: sv(`Purok ${(i % 6) + 1} · near Brgy. ${area.barangay} Hall`),
        purok: sv(`Purok ${(i % 6) + 1}`),
        phone: sv(`0917${String(2000000 + i).slice(0, 7)}`),
        email: sv(`hh${i + 1}@${area.id.replace(/\//g, ".")}.demo`),
        notes: sv(`Demo seed · Brgy. ${area.barangay}`),
        lat: nv(lat),
        lng: nv(lng),
        officerUid: sv(captainUid),
        orgName: sv(orgName),
        barangay: sv(area.barangay),
        lgu: sv(area.lgu),
        members: { arrayValue: { values: [] } },
        linkedCitizenUids: { arrayValue: { values: [] } },
        linkedOfficerUids: {
          arrayValue: { values: [{ stringValue: captainUid }] },
        },
        createdAt: sv(now),
        updatedAt: sv(now),
      },
      [
        "ownerName",
        "address",
        "purok",
        "phone",
        "email",
        "notes",
        "lat",
        "lng",
        "officerUid",
        "orgName",
        "barangay",
        "lgu",
        "updatedAt",
      ],
    );
  }

  return {
    staff: staff.length,
    officers: createdUids.length,
    households: 12,
    captainEmail: staff[0]?.email,
  };
}

async function main() {
  const apiKey = loadApiKey();
  const tok = token();
  const summary = [];

  for (const req of REQUESTS) {
    const area = resolveArea(req);
    const seedKey = area.seedId || area.id;
    const barangayDocId = seedKey.replace(/\//g, "-");

    // Prefer checking Apas/Nangka special namespaces
    let staffCount = await countStaff(tok, barangayDocId);
    if (SPECIAL[area.id] === "apas") {
      staffCount = Math.max(staffCount, await countStaff(tok, "cebu-city-apas"));
    }
    if (SPECIAL[area.id] === "nangka") {
      staffCount = Math.max(
        staffCount,
        await countStaff(tok, "nangka-consolacion"),
      );
    }
    const officerCount = await countOfficersByArea(tok, area.id);

    if (staffCount >= MIN_STAFF_TO_SKIP || officerCount >= MIN_STAFF_TO_SKIP) {
      summary.push({
        label: req.label,
        areaId: area.id,
        via: area.via,
        action: "skip",
        staffCount,
        officerCount,
      });
      console.log(
        `skip ${req.label} → ${area.id} (${area.via}) staff=${staffCount} officers=${officerCount}`,
      );
      continue;
    }

    // Apas/Nangka already have dedicated seeds — if somehow empty, still use generic
    console.log(`seed ${req.label} → ${area.id} (${area.via})`);
    try {
      const result = await seedArea(tok, apiKey, {
        ...area,
        id: seedKey,
      });
      summary.push({
        label: req.label,
        areaId: area.id,
        via: area.via,
        action: "seeded",
        ...result,
      });
      console.log(`ok ${req.label}`, result);
    } catch (err) {
      summary.push({
        label: req.label,
        areaId: area.id,
        action: "error",
        error: err instanceof Error ? err.message : String(err),
      });
      console.error(`fail ${req.label}`, err);
    }
  }

  console.log(JSON.stringify({ password: DEMO_PASSWORD, summary }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
