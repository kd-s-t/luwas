#!/usr/bin/env node
/**
 * Seed 5 Apas sitio water-shortage incidents into the Firestore emulator.
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

/** Distinct sitios around Apas hall (Generoso St). */
const REPORTS = [
  {
    id: "CEB-CC-APAS-261017-9301",
    sitio: "Sitio Mahayahay",
    name: "Rosa Villanueva",
    phone: "+63 917 401 9301",
    email: "rosa.v@apas.water.demo",
    lat: 10.3374,
    lng: 123.9045,
    title: "Water shortage · Sitio Mahayahay",
    notes:
      "Supply cut since yesterday. Need 3000 L drinking water for 40 households. Local stock empty.",
  },
  {
    id: "CEB-CC-APAS-261017-9302",
    sitio: "Sitio Kamagayan",
    name: "Paolo Mendoza",
    phone: "+63 917 401 9302",
    email: "paolo.m@apas.water.demo",
    lat: 10.3366,
    lng: 123.9056,
    title: "Water shortage · Sitio Kamagayan",
    notes:
      "Deep well dry after prolonged heat. Need 3000 L drinking water for evacuation site and nearby homes.",
  },
  {
    id: "CEB-CC-APAS-261017-9303",
    sitio: "Sitio Looc",
    name: "Irene Cabrera",
    phone: "+63 917 401 9303",
    email: "irene.c@apas.water.demo",
    lat: 10.3382,
    lng: 123.9042,
    title: "Water shortage · Sitio Looc",
    notes:
      "Pipeline break · no potable supply. Need 3000 L drinking water urgently for 35 families.",
  },
  {
    id: "CEB-CC-APAS-261017-9304",
    sitio: "Sitio Banawa",
    name: "Janet Sy",
    phone: "+63 917 401 9304",
    email: "janet.s@apas.water.demo",
    lat: 10.3370,
    lng: 123.9060,
    title: "Water shortage · Sitio Banawa",
    notes:
      "Tankers delayed. Need 3000 L drinking water for barangay hall overflow and Sitio Banawa residents.",
  },
  {
    id: "CEB-CC-APAS-261017-9305",
    sitio: "Sitio Lahug Side",
    name: "Marco Velasco",
    phone: "+63 917 401 9305",
    email: "marco.v@apas.water.demo",
    lat: 10.3385,
    lng: 123.9055,
    title: "Water shortage · Sitio Lahug Side",
    notes:
      "Contaminated source after flood. Need 3000 L drinking water for 50 people until repair.",
  },
];

const app = initializeApp({
  apiKey: "demo-api-key",
  projectId: PROJECT,
});
const db = getFirestore(app);
connectFirestoreEmulator(db, host, port);

const now = new Date().toISOString();
let n = 0;

for (const r of REPORTS) {
  await setDoc(doc(db, "reports", r.id), {
    citizenUid: "demo-map-seed",
    citizenName: r.name,
    citizenPurok: r.sitio,
    barangay: "Apas",
    lgu: "Cebu City",
    citizenPhotoURL: null,
    title: r.title,
    notes: r.notes,
    hazardHint: "flood",
    mediaType: "photo",
    mediaPath: "/reports/flood-road-chapel.png",
    mediaUrl: "/reports/flood-road-chapel.png",
    mediaMime: "image/png",
    mediaSource: "mobile-camera",
    lat: r.lat,
    lng: r.lng,
    locationAccuracyM: 28,
    locationLabel: `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit",
    aiVerdict: "legit",
    aiConfidence: 0.91,
    aiReason: "Verified · drinking water shortage for Apas Resources demo.",
    aiSource: "local",
    aiModel: "apas-water-seed",
    aiPriority: "high",
    aiPriorityFactors: {
      immediateSeverity: "Large drinking water gap · 3000 L requested.",
      peopleAffected: "Multiple households in sitio indicated.",
      existingCoverage: "Local stock cannot cover the gap.",
      deliveryFeasibility: "Road access assumed open pending field check.",
      evidenceQuality: "Seeded verified water shortage for Apas demos.",
    },
    vertexClass: null,
    vertexConfidence: null,
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
    reporterIdVerified: true,
    reporterEmail: r.email,
    reporterPhone: r.phone,
    reporterEmailVerified: true,
    trustScore: 88,
    reactionCounts: { like: 0, helpful: 0, concern: 0 },
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  n += 1;
  console.log("seeded", r.id, r.sitio);
}

console.log(`Done · ${n} Apas water reports in emulator (${HOST})`);
process.exit(0);
