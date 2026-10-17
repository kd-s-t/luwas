#!/usr/bin/env node
/**
 * Seed 5 Apas water-need + 5 Apas fire incident reports (distinct sitios).
 * Targets Firestore emulator by default.
 *
 * Usage: node scripts/seed-apas-water-reports.mjs
 */
import { initializeApp } from "firebase/app";
import {
  connectFirestoreEmulator,
  doc,
  getFirestore,
  setDoc,
} from "firebase/firestore";

const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
const HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
const [host, portStr] = HOST.split(":");
const port = Number(portStr || 8080);

const WATER = [
  {
    id: "CEB-CC-APAS-261017-8201",
    sitio: "Sitio Mahayahay",
    name: "Rosa Villanueva",
    phone: "+63 917 401 8201",
    email: "rosa.v@apas.water.demo",
    lat: 10.3374,
    lng: 123.9045,
    title: "Water shortage · Sitio Mahayahay",
    notes:
      "Supply cut since yesterday. Need 3000 L drinking water for 40 households. Local stock empty.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "CEB-CC-APAS-261017-8202",
    sitio: "Sitio Kamagayan",
    name: "Paolo Mendoza",
    phone: "+63 917 401 8202",
    email: "paolo.m@apas.water.demo",
    lat: 10.3366,
    lng: 123.9056,
    title: "Water shortage · Sitio Kamagayan",
    notes:
      "Deep well dry after prolonged heat. Need 2500 L drinking water for evacuation site and nearby homes.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "CEB-CC-APAS-261017-8203",
    sitio: "Sitio Looc",
    name: "Irene Cabrera",
    phone: "+63 917 401 8203",
    email: "irene.c@apas.water.demo",
    lat: 10.3382,
    lng: 123.9042,
    title: "Water shortage · Sitio Looc",
    notes:
      "Pipeline break · no potable supply. Need 3000 L drinking water urgently for 35 families.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "CEB-CC-APAS-261017-8204",
    sitio: "Sitio Banawa Creek",
    name: "Janet Sy",
    phone: "+63 917 401 8204",
    email: "janet.s@apas.water.demo",
    lat: 10.337,
    lng: 123.906,
    title: "Water shortage · Sitio Banawa Creek",
    notes:
      "Tankers delayed. Need 2800 L drinking water for barangay hall overflow and Sitio Banawa Creek residents.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "CEB-CC-APAS-261017-8205",
    sitio: "Sitio Lahug Approach",
    name: "Marco Velasco",
    phone: "+63 917 401 8205",
    email: "marco.v@apas.water.demo",
    lat: 10.3385,
    lng: 123.9055,
    title: "Water shortage · Sitio Lahug Approach",
    notes:
      "Contaminated source after flood. Need 3200 L drinking water for 50 people until repair.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
];

const FIRES = [
  {
    id: "CEB-CC-APAS-261017-8301",
    sitio: "Sitio Proper",
    name: "Eduardo Lim",
    phone: "+63 917 401 8301",
    email: "eduardo.l@apas.fire.demo",
    lat: 10.3372,
    lng: 123.9049,
    title: "House fire · Sitio Proper",
    notes:
      "Flames visible on second floor. Neighbors evacuating. Need BFP and water for mop-up.",
    mediaUrl: "/reports/flow-hazards/fire-1.png",
  },
  {
    id: "CEB-CC-APAS-261017-8302",
    sitio: "Sitio Chapel Road",
    name: "Carla Ong",
    phone: "+63 917 401 8302",
    email: "carla.o@apas.fire.demo",
    lat: 10.3369,
    lng: 123.9055,
    title: "Grass fire · Sitio Chapel Road",
    notes:
      "Vacant lot burning · wind toward Sitio Chapel Road homes. Smoke heavy.",
    mediaUrl: "/reports/flow-hazards/fire-2.png",
  },
  {
    id: "CEB-CC-APAS-261017-8303",
    sitio: "Sitio Salinas Lane",
    name: "Ramon Go",
    phone: "+63 917 401 8303",
    email: "ramon.g@apas.fire.demo",
    lat: 10.3365,
    lng: 123.9051,
    title: "Electrical fire · Sitio Salinas Lane",
    notes:
      "Sparking transformer then roof smoke. Power cut. Need fire response now.",
    mediaUrl: "/reports/flow-hazards/fire-1.png",
  },
  {
    id: "CEB-CC-APAS-261017-8304",
    sitio: "Sitio Escario Edge",
    name: "Nina Vargas",
    phone: "+63 917 401 8304",
    email: "nina.v@apas.fire.demo",
    lat: 10.338,
    lng: 123.9038,
    title: "Warehouse fire · Sitio Escario Edge",
    notes:
      "Smoke column from storage shed. Access from Generoso St only. Need BFP.",
    mediaUrl: "/reports/flow-hazards/fire-2.png",
  },
  {
    id: "CEB-CC-APAS-261017-8305",
    sitio: "Sitio San Jose Spur",
    name: "Kevin Chua",
    phone: "+63 917 401 8305",
    email: "kevin.c@apas.fire.demo",
    lat: 10.3376,
    lng: 123.9062,
    title: "Kitchen fire · Sitio San Jose Spur",
    notes:
      "LPG flare-up contained by neighbors but walls still hot. Need check and stand-by.",
    mediaUrl: "/reports/flow-hazards/fire-1.png",
  },
];

function mimeForUrl(url) {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function payload(r, kind) {
  const now = new Date().toISOString();
  const isFire = kind === "fire";
  return {
    // demo-map-seed + legit is allowed by place-id seed rules.
    citizenUid: "demo-map-seed",
    source: "web",
    citizenName: `Guest · ${r.name}`,
    citizenPurok: r.sitio,
    barangay: "Apas",
    lgu: "Cebu City",
    citizenPhotoURL: null,
    title: r.title,
    notes: r.notes,
    hazardHint: isFire ? "fire" : "other",
    mediaType: "photo",
    mediaPath: r.mediaUrl,
    mediaUrl: r.mediaUrl,
    mediaMime: mimeForUrl(r.mediaUrl),
    mediaSource: "mobile-camera",
    lat: r.lat,
    lng: r.lng,
    locationAccuracyM: 28,
    locationLabel: `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit",
    aiVerdict: "legit",
    aiConfidence: 0.9,
    aiReason: isFire
      ? "Verified · fire scene matches claim for Apas incident demo."
      : "Verified · drinking water shortage for Apas Resources demo.",
    aiSource: "local",
    aiModel: isFire ? "apas-fire-seed" : "apas-water-seed",
    aiPriority: isFire ? "critical" : "high",
    aiPriorityFactors: {
      immediateSeverity: isFire
        ? "Active or recent fire · life-safety risk."
        : "Large drinking water gap for the sitio.",
      peopleAffected: `Households in ${r.sitio}.`,
      existingCoverage: "Local stock cannot cover the gap.",
      deliveryFeasibility: "Confirm access from Generoso St.",
      evidenceQuality: "Seeded Apas demo report.",
    },
    vertexClass: isFire ? "fire" : null,
    vertexConfidence: isFire ? 0.88 : null,
    vertexLocationLabel: null,
    vertexLocationConfidence: null,
    vertexLocationPlaceId: null,
    vertexLocationPlaceLabel: null,
    validatedAt: now,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reporterIdVerified: false,
    reporterEmail: r.email,
    reporterPhone: r.phone,
    reporterEmailVerified: false,
    trustScore: 72,
    reactionCounts: { like: 0, helpful: 0, concern: 0 },
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

const app = initializeApp({
  apiKey: "demo-api-key",
  projectId: PROJECT,
});
const db = getFirestore(app);
connectFirestoreEmulator(db, host, port);

let n = 0;
for (const r of WATER) {
  await setDoc(doc(db, "reports", r.id), payload(r, "water"), { merge: true });
  n += 1;
  console.log("water", r.id, r.sitio);
}
for (const r of FIRES) {
  await setDoc(doc(db, "reports", r.id), payload(r, "fire"), { merge: true });
  n += 1;
  console.log("fire", r.id, r.sitio);
}

console.log(`Done · ${n} Apas reports in emulator (${HOST})`);
process.exit(0);
