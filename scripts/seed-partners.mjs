#!/usr/bin/env node
/**
 * Seed resourcePartners for Brgy. Nangka (idempotent).
 *
 * Usage:
 *   node scripts/seed-partners.mjs --local
 *   node scripts/seed-partners.mjs --prod
 */
import { execSync } from "node:child_process";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
  NANGKA_PARTNERS,
} from "./nangka-partners-seed-data.mjs";

const COL = "resourcePartners";
const args = new Set(process.argv.slice(2));
const isLocal = args.has("--local");
const isProd = args.has("--prod");

if (isLocal === isProd) {
  console.error("Usage: node scripts/seed-partners.mjs --local|--prod");
  process.exit(1);
}

async function seedLocal() {
  const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
  const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;

  // Emulator admin bypass (rules still apply to client SDK without a seeded officer).
  const headers = {
    Authorization: "Bearer owner",
    "Content-Type": "application/json",
  };

  let patched = 0;
  for (const seed of NANGKA_PARTNERS) {
    const url = `http://${FS_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${COL}/${encodeURIComponent(seed.id)}`;
    const get = await fetch(url, { headers });
    if (get.status === 200) {
      const body = await get.json();
      const fields = {};
      const masks = [];
      if (!hasLatLng(body.fields) && typeof seed.lat === "number") {
        fields.lat = dv(seed.lat);
        fields.lng = dv(seed.lng);
        masks.push("lat", "lng");
      }
      if (!hasLogoUrl(body.fields) && seed.logoUrl) {
        fields.logoUrl = sv(seed.logoUrl);
        masks.push("logoUrl");
      }
      if (
        seed.name &&
        body.fields?.name?.stringValue &&
        body.fields.name.stringValue !== seed.name
      ) {
        fields.name = sv(seed.name);
        masks.push("name");
      }
      if (
        seed.email &&
        body.fields?.email?.stringValue &&
        body.fields.email.stringValue !== seed.email
      ) {
        fields.email = sv(seed.email);
        masks.push("email");
      }
      if (
        seed.notes &&
        (body.fields?.notes?.stringValue ?? "") !== seed.notes
      ) {
        fields.notes = sv(seed.notes);
        masks.push("notes");
      }
      if (
        seed.type &&
        body.fields?.type?.stringValue &&
        body.fields.type.stringValue !== seed.type
      ) {
        fields.type = sv(seed.type);
        masks.push("type");
      }
      if (
        seed.contactName &&
        body.fields?.contactName?.stringValue &&
        body.fields.contactName.stringValue !== seed.contactName
      ) {
        fields.contactName = sv(seed.contactName);
        masks.push("contactName");
      }
      if (masks.length) {
        fields.updatedAt = sv(now);
        masks.push("updatedAt");
        const patchUrl =
          url +
          "?" +
          masks.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join("&");
        const put = await fetch(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!put.ok) {
          throw new Error(`patch ${seed.id}: ${put.status} ${await put.text()}`);
        }
        patched += 1;
        console.log("patch", seed.id, masks.filter((m) => m !== "updatedAt").join("+"));
      } else {
        skipped += 1;
        console.log("skip", seed.id);
      }
      continue;
    }
    const put = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: partnerFields(seed, now) }),
    });
    if (!put.ok) {
      throw new Error(`put ${seed.id}: ${put.status} ${await put.text()}`);
    }
    created += 1;
    console.log("ok", seed.id);
  }
  console.log(
    `local partners · created ${created} · patched ${patched} · skipped ${skipped}`,
  );
}

function token() {
  return execSync("gcloud auth print-access-token", { encoding: "utf8" }).trim();
}

function sv(s) {
  return { stringValue: s == null ? "" : String(s) };
}
function dv(n) {
  return { doubleValue: Number(n) };
}
function nullV() {
  return { nullValue: null };
}
function avStrings(arr) {
  return {
    arrayValue: {
      values: (arr ?? []).map((s) => sv(s)),
    },
  };
}

function partnerFields(seed, now) {
  return {
    name: sv(seed.name),
    type: sv(seed.type),
    contactName: sv(seed.contactName),
    phone: sv(seed.phone),
    email: sv(seed.email),
    logoUrl: seed.logoUrl ? sv(seed.logoUrl) : nullV(),
    lat: typeof seed.lat === "number" ? dv(seed.lat) : nullV(),
    lng: typeof seed.lng === "number" ? dv(seed.lng) : nullV(),
    supplies: avStrings(seed.supplies),
    coverage: sv(seed.coverage),
    notes: seed.notes ? sv(seed.notes) : nullV(),
    status: sv(seed.status ?? "active"),
    barangayId: sv(NANGKA_BARANGAY_ID),
    orgName: sv(NANGKA_ORG_NAME),
    createdAt: sv(now),
    updatedAt: sv(now),
  };
}

function hasLatLng(fields) {
  const lat = fields?.lat?.doubleValue ?? fields?.lat?.integerValue;
  const lng = fields?.lng?.doubleValue ?? fields?.lng?.integerValue;
  return lat != null && lng != null;
}

function hasLogoUrl(fields) {
  return Boolean(fields?.logoUrl?.stringValue?.trim());
}

async function seedProd() {
  const PROJECT =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "nice-pen-181017";
  const tok = token();
  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  let patched = 0;
  const headers = {
    Authorization: `Bearer ${tok}`,
    "Content-Type": "application/json",
    "x-goog-user-project": PROJECT,
  };

  for (const seed of NANGKA_PARTNERS) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${COL}/${encodeURIComponent(seed.id)}`;
    const get = await fetch(url, { headers });
    if (get.status === 200) {
      const body = await get.json();
      const fields = {};
      const masks = [];
      if (!hasLatLng(body.fields) && typeof seed.lat === "number") {
        fields.lat = dv(seed.lat);
        fields.lng = dv(seed.lng);
        masks.push("lat", "lng");
      }
      if (!hasLogoUrl(body.fields) && seed.logoUrl) {
        fields.logoUrl = sv(seed.logoUrl);
        masks.push("logoUrl");
      }
      if (
        seed.name &&
        body.fields?.name?.stringValue &&
        body.fields.name.stringValue !== seed.name
      ) {
        fields.name = sv(seed.name);
        masks.push("name");
      }
      if (
        seed.email &&
        body.fields?.email?.stringValue &&
        body.fields.email.stringValue !== seed.email
      ) {
        fields.email = sv(seed.email);
        masks.push("email");
      }
      if (
        seed.notes &&
        (body.fields?.notes?.stringValue ?? "") !== seed.notes
      ) {
        fields.notes = sv(seed.notes);
        masks.push("notes");
      }
      if (
        seed.type &&
        body.fields?.type?.stringValue &&
        body.fields.type.stringValue !== seed.type
      ) {
        fields.type = sv(seed.type);
        masks.push("type");
      }
      if (
        seed.contactName &&
        body.fields?.contactName?.stringValue &&
        body.fields.contactName.stringValue !== seed.contactName
      ) {
        fields.contactName = sv(seed.contactName);
        masks.push("contactName");
      }
      if (masks.length) {
        fields.updatedAt = sv(now);
        masks.push("updatedAt");
        const patchUrl =
          url +
          "?" +
          masks.map((m) => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join("&");
        const put = await fetch(patchUrl, {
          method: "PATCH",
          headers,
          body: JSON.stringify({ fields }),
        });
        if (!put.ok) {
          throw new Error(`patch ${seed.id}: ${put.status} ${await put.text()}`);
        }
        patched += 1;
        console.log("patch", seed.id, masks.filter((m) => m !== "updatedAt").join("+"));
      } else {
        skipped += 1;
        console.log("skip", seed.id);
      }
      continue;
    }
    if (get.status !== 404) {
      throw new Error(`get ${seed.id}: ${get.status} ${await get.text()}`);
    }
    const put = await fetch(url, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields: partnerFields(seed, now) }),
    });
    if (!put.ok) {
      throw new Error(`put ${seed.id}: ${put.status} ${await put.text()}`);
    }
    created += 1;
    console.log("ok", seed.id);
  }
  console.log(
    `prod partners · created ${created} · patched ${patched} · skipped ${skipped}`,
  );
}

async function main() {
  if (isLocal) {
    console.log("seed partners → local emulator");
    await seedLocal();
  } else {
    console.log("seed partners → prod");
    await seedProd();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
