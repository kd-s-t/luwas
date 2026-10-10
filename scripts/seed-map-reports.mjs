#!/usr/bin/env node
/**
 * Seed curated Odette map image-reports into the Firestore emulator.
 * Usage: node scripts/seed-map-reports.mjs
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

const PINS = [
  {
    id: "rpt-block-access-east",
    title: "Road blocked · fallen tree",
    hazardHint: "typhoon",
    lat: 10.3686,
    lng: 123.9658,
    purok: "Purok 6",
    name: "Marco Reyes",
    notes: "Tree across both lanes · no through traffic",
    reportedAt: "2026-10-08T01:45:00+08:00",
    mediaUrl: "/reports/road-block-access-east.jpg",
  },
  {
    id: "rpt-block-singko",
    title: "Fallen tree · Access Road",
    hazardHint: "typhoon",
    lat: 10.3704,
    lng: 123.9629,
    purok: "Purok 4",
    name: "Ana Cruz",
    notes: "Tree across both lanes · motorcycle only",
    reportedAt: "2026-10-08T01:20:00+08:00",
    mediaUrl: "/reports/fallen-tree-access-road.webp",
  },
  {
    id: "rpt-flood-chapel",
    title: "Flood road · chapel approach",
    hazardHint: "flood",
    lat: 10.3712,
    lng: 123.9594,
    purok: "Purok 4",
    name: "Ana Cruz",
    notes: "Flash flood across both lanes · road impassable",
    reportedAt: "2026-10-08T00:55:00+08:00",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
  {
    id: "rpt-landslide-east-bank",
    title: "Landslide · bank failure",
    hazardHint: "landslide",
    lat: 10.3682,
    lng: 123.9664,
    purok: "Purok 6",
    name: "Marco Reyes",
    notes: "Bank undercut · flood + slide compound risk",
    reportedAt: "2026-10-07T11:05:00+08:00",
    mediaUrl: "/reports/landslide-bank-failure.png",
  },
  {
    id: "rpt-landslide-cansaga",
    title: "Landslide · debris slide",
    hazardHint: "landslide",
    lat: 10.3742,
    lng: 123.9562,
    purok: "Purok 2",
    name: "Liza Santos",
    notes: "Mud/debris reached lane · 2 houses advised to evacuate to hall",
    reportedAt: "2026-10-07T05:15:00+08:00",
    mediaUrl: "/reports/landslide-bank-failure.png",
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
for (const pin of PINS) {
  const mime = pin.mediaUrl.endsWith(".png")
    ? "image/png"
    : pin.mediaUrl.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  await setDoc(doc(db, "reports", pin.id), {
    citizenUid: "demo-map-seed",
    citizenName: pin.name,
    citizenPurok: pin.purok,
    barangay: "Nangka",
    lgu: "Consolacion",
    citizenPhotoURL: null,
    title: pin.title,
    notes: pin.notes,
    hazardHint: pin.hazardHint,
    mediaType: "photo",
    mediaPath: pin.mediaUrl,
    mediaUrl: pin.mediaUrl,
    mediaMime: mime,
    mediaSource: "mobile-camera",
    lat: pin.lat,
    lng: pin.lng,
    locationAccuracyM: null,
    locationLabel: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit",
    aiVerdict: "legit",
    aiConfidence: 0.92,
    aiReason: "Seeded from map image report",
    aiSource: "local",
    aiModel: null,
    validatedAt: pin.reportedAt,
    reactionCounts: { like: 0, helpful: 0, concern: 0 },
    commentCount: 0,
    createdAt: pin.reportedAt,
    updatedAt: now,
  });
  n += 1;
  console.log("seeded", pin.id);
}

console.log(`Done · ${n} verified reports in emulator (${HOST})`);
process.exit(0);
