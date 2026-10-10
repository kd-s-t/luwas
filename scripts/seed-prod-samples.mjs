#!/usr/bin/env node
/**
 * Deploy Firestore rules + seed demo sample docs into production.
 *
 * Usage:
 *   node scripts/seed-prod-samples.mjs
 *
 * Auth: gcloud user token (project Owner / Editor on nice-pen-181017).
 * Idempotent: skips docs that already exist.
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
const RULES_PATH = join(ROOT, "firestore.rules");

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
function iv(n) {
  return { integerValue: String(Math.trunc(n)) };
}
function nullV() {
  return { nullValue: null };
}
function mapV(fields) {
  return { mapValue: { fields } };
}

async function deployRules(tok) {
  const content = readFileSync(RULES_PATH, "utf8");
  const create = await fetch(
    `https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`,
    {
      method: "POST",
      headers: authHeaders(tok),
      body: JSON.stringify({
        source: {
          files: [{ name: "firestore.rules", content }],
        },
      }),
    },
  );
  if (!create.ok) {
    throw new Error(`ruleset create: ${create.status} ${await create.text()}`);
  }
  const ruleset = await create.json();
  const name = ruleset.name;
  if (!name) throw new Error("ruleset create: missing name");

  const releaseName = `projects/${PROJECT}/releases/cloud.firestore`;
  const release = await fetch(
    `https://firebaserules.googleapis.com/v1/${releaseName}?updateMask=rulesetName`,
    {
      method: "PATCH",
      headers: authHeaders(tok),
      body: JSON.stringify({
        release: { name: releaseName, rulesetName: name },
      }),
    },
  );
  if (!release.ok) {
    throw new Error(`rules release: ${release.status} ${await release.text()}`);
  }
  console.log("rules ok", name);
}

function docUrl(collection, id) {
  return `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/${collection}/${encodeURIComponent(id)}`;
}

async function getDoc(tok, collection, id) {
  const res = await fetch(docUrl(collection, id), {
    headers: authHeaders(tok),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`get ${collection}/${id}: ${await res.text()}`);
  return res.json();
}

async function putDoc(tok, collection, id, fields) {
  const res = await fetch(docUrl(collection, id), {
    method: "PATCH",
    headers: authHeaders(tok),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`put ${collection}/${id}: ${res.status} ${await res.text()}`);
  }
}

async function ensure(tok, collection, id, fields) {
  const existing = await getDoc(tok, collection, id);
  if (existing) {
    console.log("skip", collection, id);
    return "skipped";
  }
  await putDoc(tok, collection, id, fields);
  console.log("ok", collection, id);
  return "created";
}

const AREA_ID = "consolacion/nangka";
const BARANGAY = "Nangka";
const LGU = "Consolacion";
const NOW = new Date().toISOString();

const PENDING = [
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

const QUEUE_REPORTS = [
  {
    id: "LUW-261011-9001",
    status: "needs_review",
    title: "Possible flood · Access Road (unclear depth)",
    notes:
      "Water on the road near Ken’s house. Caller unsure if knee-deep or just runoff. Needs ground check.",
    hazardHint: "flood",
    citizenName: "Guest · Rosa V.",
    citizenPurok: "Purok 6",
    phone: "+63 917 200 1001",
    email: "rosa.villanueva@nangka.pending.demo",
    lat: 10.3692,
    lng: 123.9623,
    mediaUrl: "/reports/flood-road-chapel.png",
    aiConfidence: 0.48,
    aiReason:
      "Low confidence · flood wording vs. photo glare; needs officer ground-truth.",
  },
  {
    id: "LUW-261011-9002",
    status: "needs_review",
    title: "Bank crack · hillside above purok path",
    notes:
      "Soil fissure after rain. No slide yet. Neighbors asking if they should leave.",
    hazardHint: "landslide",
    citizenName: "Guest · Miguel S.",
    citizenPurok: "Purok 4",
    phone: "+63 917 200 1002",
    email: "miguel.santos@nangka.pending.demo",
    lat: 10.3711,
    lng: 123.9608,
    mediaUrl: "/reports/landslide-bank-failure.png",
    aiConfidence: 0.52,
    aiReason:
      "Ambiguous slope risk · photo shows crack but no active debris; human review.",
  },
  {
    id: "LUW-261011-9003",
    status: "needs_review",
    title: "Smoke near chapel · wind toward houses",
    notes: "Thin smoke column. Unclear if brush fire or trash burn.",
    hazardHint: "fire",
    citizenName: "Guest · Elena C.",
    citizenPurok: "Purok 1",
    phone: "+63 917 200 1003",
    email: "elena.cruz@nangka.pending.demo",
    lat: 10.3705,
    lng: 123.9592,
    mediaUrl: "/reports/free-generator-nangka.png",
    aiConfidence: 0.45,
    aiReason: "Fire vs. cooking smoke ambiguous · needs ground check.",
  },
  {
    id: "LUW-261011-9004",
    status: "needs_review",
    title: "Wire down after gust · Access Road east",
    notes: "Line hanging low over lane. No sparking seen yet.",
    hazardHint: "typhoon",
    citizenName: "Guest · Marco T.",
    citizenPurok: "Purok 5",
    phone: "+63 917 200 1004",
    email: "marco.tan@nangka.pending.demo",
    lat: 10.3698,
    lng: 123.9641,
    mediaUrl: "/reports/road-block-access-east.jpg",
    aiConfidence: 0.55,
    aiReason: "Utility hazard · confirm with BATELEC / tanod before public post.",
  },
  {
    id: "LUW-261011-9005",
    status: "needs_review",
    title: "Evac center capacity claim unverified",
    notes: "Caller says hall is full. No count provided.",
    hazardHint: "evac",
    citizenName: "Guest · Liza M.",
    citizenPurok: "Purok 2",
    phone: "+63 917 200 1005",
    email: "liza.mendez@nangka.pending.demo",
    lat: 10.3707,
    lng: 123.9591,
    mediaUrl: "/reports/ec-consolacion-1.jpg",
    aiConfidence: 0.4,
    aiReason:
      "Capacity claim unverified · needs ops count before public status update.",
  },
  {
    id: "LUW-261011-9101",
    status: "rejected",
    title: "Alien landing · Purok 6",
    notes: "Bright lights in the sky. Definitely not a plane.",
    hazardHint: "other",
    citizenName: "Guest · Prank A.",
    citizenPurok: "Purok 6",
    phone: "+63 900 111 0001",
    email: "prank.a@nangka.reject.demo",
    lat: 10.3688,
    lng: 123.962,
    mediaUrl: "/reports/free-wifi-nangka.png",
    aiConfidence: 0.94,
    aiReason: "Non-hazard / joke content · auto-rejected.",
  },
  {
    id: "LUW-261011-9102",
    status: "rejected",
    title: "Duplicate flood report (copy-paste)",
    notes: "Same text as earlier post. No new location detail.",
    hazardHint: "flood",
    citizenName: "Guest · Prank B.",
    citizenPurok: "Purok 5",
    phone: "+63 900 111 0002",
    email: "prank.b@nangka.reject.demo",
    lat: 10.3695,
    lng: 123.9612,
    mediaUrl: "/reports/flood-road-chapel.png",
    aiConfidence: 0.91,
    aiReason: "Duplicate / spam pattern · rejected.",
  },
  {
    id: "LUW-261011-9103",
    status: "rejected",
    title: "Stock photo of flood (not Nangka)",
    notes: "Downloaded image from the internet. Location pin random.",
    hazardHint: "flood",
    citizenName: "Guest · Prank C.",
    citizenPurok: "Purok 2",
    phone: "+63 900 111 0003",
    email: "prank.c@nangka.reject.demo",
    lat: 10.3715,
    lng: 123.957,
    mediaUrl: "/reports/flood-road-chapel.png",
    aiConfidence: 0.88,
    aiReason: "Media fails field-capture checks · rejected.",
  },
  {
    id: "LUW-261011-9104",
    status: "rejected",
    title: "Complaint about neighbor music",
    notes: "Loud karaoke since 10pm. Not a disaster.",
    hazardHint: "other",
    citizenName: "Guest · Prank D.",
    citizenPurok: "Purok 1",
    phone: "+63 900 111 0004",
    email: "prank.d@nangka.reject.demo",
    lat: 10.3702,
    lng: 123.9595,
    mediaUrl: "/reports/free-generator-nangka.png",
    aiConfidence: 0.96,
    aiReason: "Out of scope for hazard queue · rejected.",
  },
  {
    id: "LUW-261011-9105",
    status: "rejected",
    title: "Empty / gibberish report",
    notes: "asdf asdf test 123 !!!",
    hazardHint: "other",
    citizenName: "Guest · Prank E.",
    citizenPurok: "Purok 3",
    phone: "+63 900 111 0005",
    email: "prank.e@nangka.reject.demo",
    lat: 10.3699,
    lng: 123.9602,
    mediaUrl: "/reports/road-block-access-east.jpg",
    aiConfidence: 0.97,
    aiReason: "No actionable hazard content · rejected.",
  },
];

const SUPPORT = [
  {
    id: "sup-sample-001",
    status: "open",
    email: "rosa.villanueva@nangka.pending.demo",
    pageUrl: "/citizen",
    summary: "Citizen report map pin jumps after confirm",
    details:
      "On mobile Safari, after I confirm a flood report the map recenter jumps to the wrong purok. Happened twice tonight near Purok 6.",
    uid: "sample-citizen-rosa",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-002",
    status: "open",
    email: "miguel.santos@nangka.pending.demo",
    pageUrl: "/login",
    summary: "Login spinner never finishes on slow network",
    details:
      "Wi‑Fi dropped mid-login. Spinner kept going for 2+ minutes with no error. Hard refresh fixed it.",
    uid: "sample-citizen-miguel",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-003",
    status: "open",
    email: "ana.reyes@nangka.pending.demo",
    pageUrl: "/my-reports",
    summary: "My reports page blank after posting photo",
    details:
      "Posted a landslide photo from the citizen flow. Redirect to My reports showed empty list until I signed out and back in.",
    uid: "sample-citizen-ana",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-004",
    status: "in_progress",
    email: "bfp.desk@nangka.demo",
    pageUrl: "/command",
    summary: "Command header badges stale until full reload",
    details:
      "Users pending badge stayed at 5 after I approved someone. Field reports badge updated only after refresh.",
    uid: "sample-officer-bfp",
    assignedToUid: "sample-assignee-mdrrmo",
    assignedToName: "Demo · MDRRMO Focal",
  },
  {
    id: "sup-sample-005",
    status: "open",
    email: "guest@luwas.local",
    pageUrl: "/support",
    summary: "Support form rejects long details past ~4k chars",
    details:
      "Pasted a long crash log; submit failed with ‘Details are too long.’ Expected a clearer counter before submit.",
    uid: "sample-citizen-guest",
    assignedToUid: null,
    assignedToName: null,
  },
];

const MAP_REPORTS = [
  {
    id: "rpt-block-access-east",
    title: "Road blocked · fallen tree",
    hazardHint: "typhoon",
    lat: 10.3686,
    lng: 123.9658,
    purok: "Purok 6",
    name: "Marco Tan",
    notes: "Tree across both lanes · no through traffic",
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
    mediaUrl: "/reports/landslide-bank-failure.png",
  },
];

function mimeForUrl(url) {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

function idProofFields() {
  return {
    idVerified: bv(true),
    idType: sv("umid"),
    idConfidence: nv(1),
    idReason: sv("Demo prod sample seed"),
    idSource: sv("local"),
    idVerifiedAt: sv(NOW),
    photoURL: nullV(),
    idDocumentPath: nullV(),
    faceDocumentPath: nullV(),
  };
}

function pendingFields(sample) {
  const base = {
    uid: sv(sample.uid),
    email: sv(sample.email),
    displayName: sv(sample.displayName),
    role: sv(sample.role),
    accountStatus: sv("pending"),
    barangay: sv(BARANGAY),
    lgu: sv(LGU),
    areaId: sv(AREA_ID),
    createdAt: sv(NOW),
    updatedAt: sv(NOW),
    ...idProofFields(),
  };
  if (sample.role === "citizen") {
    return {
      ...base,
      purok: sv(sample.purok),
      phone: sv(sample.phone),
      householdId: nullV(),
    };
  }
  return {
    ...base,
    orgName: sv(sample.orgName),
    officerTitle: sv(sample.officerTitle),
    staffRank: sv(sample.staffRank),
    officerRank: sv("officer"),
    activeBarangayId: nullV(),
    employmentHistory: { arrayValue: { values: [] } },
  };
}

function reportFields(sample, opts = {}) {
  const mime = mimeForUrl(sample.mediaUrl);
  return {
    citizenUid: sv(opts.citizenUid || "web-guest"),
    source: sv("web"),
    citizenName: sv(sample.citizenName || sample.name),
    citizenPurok: sv(sample.citizenPurok || sample.purok),
    barangay: sv(BARANGAY),
    lgu: sv(LGU),
    citizenPhotoURL: nullV(),
    title: sv(sample.title),
    notes: sv(sample.notes),
    hazardHint: sv(sample.hazardHint),
    mediaType: sv("photo"),
    mediaPath: sv(sample.mediaUrl),
    mediaUrl: sv(sample.mediaUrl),
    mediaMime: sv(mime),
    mediaSource: sv("mobile-camera"),
    lat: nv(sample.lat),
    lng: nv(sample.lng),
    locationAccuracyM: nv(35),
    locationLabel: sv(`${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`),
    device: sv("Prod sample seed"),
    ipAddress: nullV(),
    status: sv(sample.status || "legit"),
    aiVerdict: sv(sample.status || "legit"),
    aiConfidence: nv(sample.aiConfidence ?? 0.85),
    aiReason: sv(sample.aiReason || "Curated map seed"),
    aiSource: sv("local"),
    aiModel: sv("sample-seed"),
    validatedAt: sv(NOW),
    reporterIdVerified: bv(false),
    reporterEmail: sv(sample.email || ""),
    reporterPhone: sv(sample.phone || ""),
    reporterEmailVerified: bv(false),
    trustScore: iv(40),
    trustBreakdown: mapV({ total: iv(40) }),
    reactionCounts: mapV({
      like: iv(0),
      helpful: iv(0),
      confirm: iv(0),
      concern: iv(0),
    }),
    commentCount: iv(0),
    createdAt: sv(NOW),
    updatedAt: sv(NOW),
  };
}

function supportFields(sample) {
  return {
    kind: sv("bug"),
    email: sv(sample.email),
    pageUrl: sv(sample.pageUrl),
    summary: sv(sample.summary),
    details: sv(sample.details),
    uid: sv(sample.uid),
    status: sv(sample.status),
    userAgent: sv("LUWAS prod sample seed"),
    createdAt: sv(NOW),
    assignedToUid: sample.assignedToUid ? sv(sample.assignedToUid) : nullV(),
    assignedToName: sample.assignedToName
      ? sv(sample.assignedToName)
      : nullV(),
    resolvedAt: nullV(),
    resolvedByUid: nullV(),
    resolvedByName: nullV(),
    resolutionNote: nullV(),
  };
}

async function main() {
  console.log("prod sample seed →", PROJECT);
  const tok = token();

  console.log("\n— Firestore rules —");
  try {
    await deployRules(tok);
  } catch (err) {
    console.warn("rules deploy failed (continuing seed):", err.message || err);
  }

  console.log("\n— Pending accounts —");
  for (const p of PENDING) {
    await ensure(tok, "users", p.uid, pendingFields(p));
  }

  console.log("\n— Queue sample reports —");
  for (const r of QUEUE_REPORTS) {
    await ensure(tok, "reports", r.id, reportFields(r));
  }

  console.log("\n— Map sample reports —");
  for (const r of MAP_REPORTS) {
    await ensure(
      tok,
      "reports",
      r.id,
      reportFields(
        { ...r, status: "legit", aiConfidence: 0.9, aiReason: "Curated map seed" },
        { citizenUid: "demo-map-seed" },
      ),
    );
  }

  console.log("\n— Support tickets —");
  for (const t of SUPPORT) {
    await ensure(tok, "supportTickets", t.id, supportFields(t));
  }

  console.log("\nDone. Open prod Command pages to confirm badges/inbox.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
