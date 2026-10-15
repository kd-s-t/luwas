#!/usr/bin/env node
/**
 * Create / refresh the four LUWAS developer Auth + Firestore users (About us team).
 *
 * Usage: node scripts/seed-developer-prod.mjs
 * Password: demo1234
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

const DEVELOPERS = [
  {
    email: "ken@luwas.demo",
    displayName: "Ken Dan Tinio",
    title: "Fullstack Engineer",
  },
  {
    email: "don@luwas.demo",
    displayName: "Don Sebial",
    title: "Product Designer",
  },
  {
    email: "jean@luwas.demo",
    displayName: "Jeanilou Labajo",
    title: "System Analyst",
  },
  {
    email: "pat@luwas.demo",
    displayName: "Patricia Abrenica",
    title: "Application Support Analyst",
  },
];

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
      `signIn ${email}: ${signIn.status} ${(await signIn.text()).slice(0, 200)}`,
    );
  }
  const data = await signIn.json();
  return { uid: data.localId, created: false };
}

async function upsertProfile(tok, uid, member) {
  const now = new Date().toISOString();
  const fields = {
    uid: { stringValue: uid },
    email: { stringValue: member.email },
    displayName: { stringValue: member.displayName },
    role: { stringValue: "developer" },
    accountStatus: { stringValue: "active" },
    orgName: { stringValue: `UgnAI Labs · ${member.title}` },
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
    throw new Error(
      `profile ${member.email}: ${create.status} ${(await create.text()).slice(0, 200)}`,
    );
  }
  if (create.status === 409) {
    res = await fetch(url, {
      method: "PATCH",
      headers: authHeaders(tok),
      body: JSON.stringify({ fields }),
    });
    if (!res.ok) throw new Error(`profile retry ${member.email}: ${res.status}`);
  }
}

async function main() {
  const apiKey = loadApiKey();
  const tok = token();
  const results = [];
  for (const member of DEVELOPERS) {
    const auth = await ensureAuthUser(apiKey, member.email, member.displayName);
    await upsertProfile(tok, auth.uid, member);
    results.push({
      email: member.email,
      name: member.displayName,
      uid: auth.uid,
      created: auth.created,
    });
    console.log(
      `${auth.created ? "created" : "ok"} ${member.email} → ${auth.uid}`,
    );
  }
  console.log(
    JSON.stringify(
      {
        password: DEMO_PASSWORD,
        login: "/login/developer",
        home: "/dev",
        developers: results,
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
