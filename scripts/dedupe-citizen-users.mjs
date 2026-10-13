#!/usr/bin/env node
/**
 * Delete duplicate citizen `users` docs that share the same email (keep one).
 *
 * Usage:
 *   node scripts/dedupe-citizen-users.mjs
 *
 * Auth: gcloud user token (Owner/Editor on nice-pen-181017).
 */
import { execSync } from "node:child_process";

const PROJECT =
  process.env.FIREBASE_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
  "nice-pen-181017";

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

function field(doc, key) {
  const f = doc?.fields?.[key];
  if (!f) return "";
  if ("stringValue" in f) return String(f.stringValue ?? "");
  if ("nullValue" in f) return "";
  return "";
}

function score(doc, authUid) {
  const id = doc.name.split("/").pop();
  const status = field(doc, "accountStatus") || "active";
  let s = 0;
  if (authUid && id === authUid) s += 100;
  if (status === "active" || status === "") s += 10;
  if (field(doc, "householdId")) s += 5;
  if (field(doc, "phone")) s += 1;
  if (field(doc, "displayName")) s += 1;
  // Prefer real Auth-looking ids over pending-sample-* seeds.
  if (!id.startsWith("pending-")) s += 2;
  return s;
}

async function listCollection(tok, collection) {
  const out = [];
  let pageToken = "";
  for (;;) {
    const url = new URL(
      `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}`,
    );
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: authHeaders(tok) });
    if (!res.ok) throw new Error(`list ${collection}: ${await res.text()}`);
    const json = await res.json();
    for (const doc of json.documents ?? []) out.push(doc);
    pageToken = json.nextPageToken || "";
    if (!pageToken) break;
  }
  return out;
}

async function lookupAuthUid(tok, email) {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`,
    {
      method: "POST",
      headers: authHeaders(tok),
      body: JSON.stringify({ email: [email] }),
    },
  );
  if (!res.ok) {
    // Not fatal — fall back to Firestore scoring.
    return null;
  }
  const json = await res.json();
  const user = json.users?.[0];
  return user?.localId ?? null;
}

async function deleteDoc(tok, collection, id) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
  const res = await fetch(url, { method: "DELETE", headers: authHeaders(tok) });
  if (!res.ok && res.status !== 404) {
    throw new Error(`delete ${collection}/${id}: ${res.status} ${await res.text()}`);
  }
}

async function patchLinkedUids(tok, householdId, linked) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/households/${encodeURIComponent(householdId)}?updateMask.fieldPaths=linkedCitizenUids&updateMask.fieldPaths=updatedAt`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({
      fields: {
        linkedCitizenUids: {
          arrayValue: {
            values: linked.map((uid) => ({ stringValue: uid })),
          },
        },
        updatedAt: { stringValue: new Date().toISOString() },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`patch household ${householdId}: ${await res.text()}`);
  }
}

async function main() {
  const tok = token();
  const users = await listCollection(tok, "users");
  const citizens = users.filter((d) => field(d, "role") === "citizen");

  /** @type {Map<string, typeof citizens>} */
  const byEmail = new Map();
  for (const doc of citizens) {
    const email = field(doc, "email").trim().toLowerCase();
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(doc);
    byEmail.set(email, list);
  }

  const deleted = [];
  const kept = [];

  for (const [email, docs] of byEmail) {
    if (docs.length < 2) continue;
    const authUid = await lookupAuthUid(tok, email);
    const ranked = [...docs].sort(
      (a, b) => score(b, authUid) - score(a, authUid),
    );
    const keep = ranked[0];
    const keepId = keep.name.split("/").pop();
    kept.push({ email, uid: keepId, authUid });
    for (const drop of ranked.slice(1)) {
      const id = drop.name.split("/").pop();
      await deleteDoc(tok, "users", id);
      deleted.push({ email, uid: id });
      console.log("deleted", email, id);
    }
    console.log("kept", email, keepId, authUid ? `(auth ${authUid})` : "(no auth match)");
  }

  // Scrub deleted uids from household linkedCitizenUids.
  if (deleted.length) {
    const deletedSet = new Set(deleted.map((d) => d.uid));
    const households = await listCollection(tok, "households");
    for (const h of households) {
      const id = h.name.split("/").pop();
      const raw = h.fields?.linkedCitizenUids?.arrayValue?.values ?? [];
      const linked = raw
        .map((v) => v.stringValue)
        .filter((uid) => typeof uid === "string" && uid);
      const next = linked.filter((uid) => !deletedSet.has(uid));
      if (next.length !== linked.length) {
        await patchLinkedUids(tok, id, next);
        console.log(
          "scrubbed household",
          id,
          `removed ${linked.length - next.length} link(s)`,
        );
      }
    }
  }

  console.log(
    JSON.stringify(
      { deleted: deleted.length, kept: kept.length, details: { deleted, kept } },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
