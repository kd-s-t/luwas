import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { NANGKA_REPORT_PREFIX } from "@/lib/reports/reportId";
import { computeReportTrust } from "@/lib/reports/trustScore";

/** Firestore seed author (rules allow rpt-* and place ids with status legit). */
const SEED_UID = "demo-map-seed";

/**
 * Demo incidents for Resources shortage desk.
 * Five distinct Nangka puroks · drinking water only → RS-001 list.
 */
export const RESOURCE_SHORTAGE_REPORT_ID = `${NANGKA_REPORT_PREFIX}-261017-9201`;
export const RESOURCE_SHORTAGE_REPORT_ID_LEGACY = "rpt-resource-nangka-flood";

/** Five puroks · one water request each (no food packs → stays RS-001). */
const NANGKA_WATER_SITIO_SAMPLES = [
  {
    id: RESOURCE_SHORTAGE_REPORT_ID,
    purok: "Purok 6",
    name: "Rosa V.",
    email: "rosa.villanueva@nangka.resource.demo",
    phone: "+63 917 200 9201",
    lat: 10.3694,
    lng: 123.9621,
    waterL: 1200,
    people: 320,
    localStockL: 0,
    readiness: "ready" as const,
  },
  {
    id: `${NANGKA_REPORT_PREFIX}-261017-9202`,
    purok: "Purok 3",
    name: "Benito Cruz",
    email: "benito.cruz@nangka.resource.demo",
    phone: "+63 917 200 9202",
    lat: 10.371,
    lng: 123.9605,
    waterL: 1000,
    people: 250,
    localStockL: 200,
    readiness: "access_unknown" as const,
  },
  {
    id: `${NANGKA_REPORT_PREFIX}-261017-9203`,
    purok: "Purok 1",
    name: "Ana Dela Peña",
    email: "ana.delapena@nangka.resource.demo",
    phone: "+63 917 200 9203",
    lat: 10.3682,
    lng: 123.9588,
    waterL: 800,
    people: 180,
    localStockL: 300,
    readiness: "no_transport" as const,
  },
  {
    id: `${NANGKA_REPORT_PREFIX}-261017-9204`,
    purok: "Purok 4",
    name: "Carlo Mendoza",
    email: "carlo.mendoza@nangka.resource.demo",
    phone: "+63 917 200 9204",
    lat: 10.3702,
    lng: 123.9612,
    waterL: 900,
    people: 210,
    localStockL: 0,
    readiness: "ready" as const,
  },
  {
    id: `${NANGKA_REPORT_PREFIX}-261017-9205`,
    purok: "Purok 2",
    name: "Liza Tan",
    email: "liza.tan@nangka.resource.demo",
    phone: "+63 917 200 9205",
    lat: 10.3675,
    lng: 123.9595,
    waterL: 700,
    people: 190,
    localStockL: 150,
    readiness: "access_unknown" as const,
  },
] as const;

function readinessNote(
  readiness: (typeof NANGKA_WATER_SITIO_SAMPLES)[number]["readiness"],
): string {
  if (readiness === "no_transport") {
    return "No transport for tanker delivery.";
  }
  if (readiness === "access_unknown") {
    return "Access unknown pending ground check.";
  }
  return "Access road open.";
}

function buildRow(
  sample: (typeof NANGKA_WATER_SITIO_SAMPLES)[number],
  now: string,
) {
  const trust = computeReportTrust({
    registered: true,
    idVerified: true,
    email: sample.email,
    phone: sample.phone,
    emailVerified: true,
    mediaSource: "mobile-camera",
    lat: sample.lat,
    lng: sample.lng,
    locationAccuracyM: 28,
    aiConfidence: 0.91,
    aiVerdict: "legit",
  });
  const stockLine =
    sample.localStockL === 0
      ? "Local stock empty (0 L local)."
      : `${sample.localStockL} L local stock on hand.`;

  return {
    citizenUid: SEED_UID,
    citizenName: sample.name,
    citizenPurok: sample.purok,
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
    citizenPhotoURL: null,
    title: `Need ${sample.waterL} L drinking water · ${sample.purok}`,
    notes: `${sample.people} people affected in ${sample.purok}. ${stockLine} Need ${sample.waterL} L drinking water. ${readinessNote(sample.readiness)}`,
    hazardHint: "flood" as const,
    mediaType: "photo" as const,
    mediaPath: "/reports/flood-road-chapel.png",
    mediaUrl: "/reports/flood-road-chapel.png",
    mediaMime: "image/png",
    mediaSource: "mobile-camera" as const,
    lat: sample.lat,
    lng: sample.lng,
    locationAccuracyM: 28,
    locationLabel: `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit" as const,
    aiVerdict: "legit" as const,
    aiConfidence: 0.91,
    aiReason: "Verified · drinking water shortage for Resources desk demo.",
    aiSource: "local" as const,
    aiModel: "resource-seed",
    aiPriority: "high",
    aiPriorityFactors: {
      immediateSeverity: "Drinking water shortage · households need supply.",
      peopleAffected: `${sample.people} people in ${sample.purok}.`,
      existingCoverage: "Local stock cannot cover the gap.",
      deliveryFeasibility: readinessNote(sample.readiness),
      evidenceQuality: "Seeded verified shortage for Resources desk demos.",
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
    reporterEmail: sample.email,
    reporterPhone: sample.phone,
    reporterEmailVerified: true,
    trustScore: trust.total,
    trustBreakdown: trust,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    createdAt: now,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };
}

/**
 * Create-or-repair five distinct purok water requests for the shortage desk.
 */
export async function ensureResourceShortageReport(): Promise<{
  id: string;
  created: number;
  repaired: number;
}> {
  const db = getClientDb();
  const now = new Date().toISOString();
  let created = 0;
  let repaired = 0;

  for (const sample of NANGKA_WATER_SITIO_SAMPLES) {
    const ref = doc(db, "reports", sample.id);
    const existing = await getDoc(ref);
    const row = buildRow(sample, now);
    if (!existing.exists()) {
      await setDoc(ref, row);
      created += 1;
      continue;
    }
    const data = existing.data() as {
      status?: string;
      notes?: string;
      citizenPurok?: string;
      title?: string;
    };
    // Always refresh demo copy so the desk shows five sitios.
    const drift =
      data.status !== "legit" ||
      data.citizenPurok !== sample.purok ||
      data.title !== row.title ||
      !data.notes?.includes(`${sample.waterL} L drinking water`) ||
      /food\s+packs/i.test(data.notes ?? "");
    if (!drift) continue;
    await setDoc(
      ref,
      {
        ...row,
        createdAt: existing.data()?.createdAt ?? now,
        createdAtServer: existing.data()?.createdAtServer ?? serverTimestamp(),
      },
      { merge: true },
    );
    repaired += 1;
  }

  const legacyRef = doc(db, "reports", RESOURCE_SHORTAGE_REPORT_ID_LEGACY);
  const legacySnap = await getDoc(legacyRef);
  if (!legacySnap.exists()) {
    await setDoc(legacyRef, {
      ...buildRow(NANGKA_WATER_SITIO_SAMPLES[0]!, now),
      status: "done",
    });
    created += 1;
  } else if (legacySnap.data()?.status !== "done") {
    await setDoc(
      legacyRef,
      {
        status: "done",
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      },
      { merge: true },
    );
    repaired += 1;
  }

  return { id: RESOURCE_SHORTAGE_REPORT_ID, created, repaired };
}
