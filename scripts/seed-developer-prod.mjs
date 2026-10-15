#!/usr/bin/env node
/**
 * Create / refresh the LUWAS developer Auth + Firestore user in production.
 *
 * Usage: node scripts/seed-developer-prod.mjs
 * Login: developer@luwas.demo / demo1234
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
const EMAIL = "developer@luwas.demo";
const DISPLAY_NAME = "LUWAS Developer";

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

async function ensureAuthUser(apiKey) {
  const signUp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: DEMO_PASSWORD,
        displayName: DISPLAY_NAME,
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
    throw new Error(`signUp: ${signUp.status} ${errText.slice(0, 200)}`);
  }
  const signIn = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: EMAIL,
        password: DEMO_PASSWORD,
        returnSecureToken: true,
      }),
    },
  );
  if (!signIn.ok) {
    throw new Error(`signIn: ${signIn.status} ${(await signIn.text()).slice(0, 200)}`);
  }
  const data = await signIn.json();
  return { uid: data.localId, created: false };
}

async function upsertProfile(tok, uid) {
  const now = new Date().toISOString();
  const fields = {
    uid: { stringValue: uid },
    email: { stringValue: EMAIL },
    displayName: { stringValue: DISPLAY_NAME },
    role: { stringValue: "developer" },
    accountStatus: { stringValue: "active" },
    orgName: { stringValue: "LUWAS Developers" },
    idVerified: { booleanValue: true },
    createdAt: { stringValue: now },
    updatedAt: { stringValue: now },
  };
  const paths = Object.keys(fields)
    .map((p) => `updateMask.fieldPaths=${encodeURIComponent(p)}`)
    .join("&");
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users/${uid}?${paths}`;
  let res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (res.ok) return;
  const create = await fetch(
    `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/users?documentId=${encodeURIComponent(uid)}`,
    {
      method: "POST",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    },
  );
  if (!create.ok && create.status !== 409) {
    throw new Error(`profile: ${create.status} ${(await create.text()).slice(0, 200)}`);
  }
  if (create.status === 409) {
    res = await fetch(url, {
      method: "PATCH",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`profile retry: ${res.status}`);
  }
}

async function main() {
  const apiKey = loadApiKey();
  const tok = token();
  const auth = await ensureAuthUser(apiKey);
  await upsertProfile(tok, auth.uid);
  console.log(
    JSON.stringify(
      {
        email: EMAIL,
        password: DEMO_PASSWORD,
        uid: auth.uid,
        created: auth.created,
        login: "/login/developer",
        home: "/dev",
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
