import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import {
  APAS_AREA_ID,
  APAS_HALL,
  APAS_ORG_NAME,
  CURATED_APAS_HOUSEHOLDS,
} from "@/lib/households/apasCuratedSeed";
import { addHouseholds } from "@/lib/households/api";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_STAFF_SEED,
} from "@/lib/staff/apasStaff";
import { upsertStaffMember } from "@/lib/staff/api";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type { ReportHazardHint, ReportStatus } from "@/lib/reports/types";

const GUEST_UID = "web-guest";

type ApasSample = {
  id: string;
  status: Extract<ReportStatus, "needs_review" | "queued" | "rejected">;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  citizenName: string;
  citizenPurok: string;
  phone: string;
  email: string;
  lat: number;
  lng: number;
  mediaUrl: string;
  aiConfidence: number;
  aiReason: string;
};

/** Legacy Apas queue samples — no longer seeded (removed from board). */
export const APAS_QUEUE_SAMPLES: ApasSample[] = [];

/** Drinking-water shortages · five Apas sitios (one request each). */
export const APAS_WATER_NEED_REPORTS = [
  {
    id: "CEB-CC-APAS-261017-8201",
    sitio: "Sitio Mahayahay",
    name: "Rosa Villanueva",
    phone: "+63 917 401 8201",
    email: "rosa.v@apas.water.demo",
    lat: 10.3374,
    lng: 123.9045,
    title: "Need 1200 L drinking water · Sitio Mahayahay",
    notes:
      "320 people affected in Sitio Mahayahay. Local stock empty (0 L local). Need 1200 L drinking water until supply restored.",
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
    title: "Need 1000 L drinking water · Sitio Kamagayan",
    notes:
      "250 people affected in Sitio Kamagayan. 200 L local stock on hand. Need 1000 L drinking water. Access unknown pending ground check.",
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
    title: "Need 800 L drinking water · Sitio Looc",
    notes:
      "180 people affected in Sitio Looc. 300 L local stock on hand. Need 800 L drinking water. No transport for tanker delivery.",
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
    title: "Need 900 L drinking water · Sitio Banawa Creek",
    notes:
      "210 people affected in Sitio Banawa Creek. Local stock empty (0 L local). Need 900 L drinking water until supply restored.",
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
    title: "Need 700 L drinking water · Sitio Lahug Approach",
    notes:
      "190 people affected in Sitio Lahug Approach. 150 L local stock on hand. Need 700 L drinking water. Access unknown pending ground check.",
    mediaUrl: "/reports/flood-road-chapel.png",
  },
] as const;

/** Fire field reports · distinct Apas sitios. */
export const APAS_FIRE_INCIDENT_REPORTS = [
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
] as const;

function mimeForUrl(url: string): string {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

async function ensureApasStaff(): Promise<number> {
  for (const input of APAS_STAFF_SEED) {
    await upsertStaffMember(APAS_BARANGAY_DOC_ID, APAS_ORG_NAME, input);
  }
  return APAS_STAFF_SEED.length;
}

async function ensureApasHouseholds(officerUid: string): Promise<number> {
  const snap = await getDocs(
    query(
      collection(getClientDb(), "households"),
      where("officerUid", "==", officerUid),
    ),
  );
  const existing = snap.docs.map((d) => {
    const data = d.data();
    return {
      ownerName: String(data.ownerName ?? ""),
      email: String(data.email ?? ""),
      lat: typeof data.lat === "number" ? data.lat : null,
    };
  });

  const missing = CURATED_APAS_HOUSEHOLDS.filter((input) => {
    const email = input.email.trim().toLowerCase();
    if (email) {
      return !existing.some((h) => h.email.trim().toLowerCase() === email);
    }
    const name = input.ownerName.trim().toLowerCase();
    return !existing.some(
      (h) =>
        h.ownerName.trim().toLowerCase() === name &&
        h.lat != null &&
        input.lat != null &&
        Math.abs(h.lat - input.lat) < 1e-4,
    );
  });

  if (missing.length === 0) return 0;
  return addHouseholds(officerUid, APAS_ORG_NAME, missing);
}

/** Water need + fire incident demos for Apas (create-if-missing). */
export async function ensureApasWaterAndFireReports(): Promise<number> {
  const db = getClientDb();
  let created = 0;
  const now = new Date().toISOString();

  type Demo = {
    id: string;
    sitio: string;
    name: string;
    phone: string;
    email: string;
    lat: number;
    lng: number;
    title: string;
    notes: string;
    mediaUrl: string;
    hazardHint: ReportHazardHint;
    aiReason: string;
    aiModel: string;
    priority: "critical" | "high";
    /** Place-id seed rules only allow legit for demo-map-seed. */
    status: "legit";
  };

  const demos: Demo[] = [
    ...APAS_WATER_NEED_REPORTS.map((r) => ({
      ...r,
      hazardHint: "other" as const,
      aiReason:
        "Drinking water shortage · Need 3000 L. Confirm households and access.",
      aiModel: "apas-water-seed",
      priority: "high" as const,
      status: "legit" as const,
    })),
    ...APAS_FIRE_INCIDENT_REPORTS.map((r) => ({
      ...r,
      hazardHint: "fire" as const,
      aiReason: "Verified · fire scene matches claim for Apas incident demo.",
      aiModel: "apas-fire-seed",
      priority: "critical" as const,
      status: "legit" as const,
    })),
  ];

  for (const sample of demos) {
    const ref = doc(db, "reports", sample.id);
    const existing = await getDoc(ref);
    const trust = computeReportTrust({
      registered: false,
      idVerified: false,
      email: sample.email,
      phone: sample.phone,
      emailVerified: false,
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 28,
      aiConfidence: 0.9,
      aiVerdict: "legit",
    });

    const row = {
      // Place-id seed path requires demo-map-seed + status legit.
      citizenUid: "demo-map-seed",
      source: "web",
      citizenName: `Guest · ${sample.name}`,
      citizenPurok: sample.sitio,
      barangay: "Apas",
      lgu: "Cebu City",
      citizenPhotoURL: null,
      title: sample.title,
      notes: sample.notes,
      hazardHint: sample.hazardHint,
      mediaType: "photo",
      mediaPath: sample.mediaUrl,
      mediaUrl: sample.mediaUrl,
      mediaMime: mimeForUrl(sample.mediaUrl),
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 28,
      locationLabel: `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`,
      device: "Android · mobile",
      ipAddress: null,
      status: sample.status,
      aiVerdict: "legit",
      aiConfidence: 0.9,
      aiReason: sample.aiReason,
      aiSource: "local",
      aiModel: sample.aiModel,
      aiPriority: sample.priority,
      aiPriorityFactors: {
        immediateSeverity:
          sample.hazardHint === "fire"
            ? "Active or recent fire · life-safety risk."
            : `${sample.title} · stock gap.`,
        peopleAffected: `Households in ${sample.sitio}.`,
        existingCoverage:
          sample.hazardHint === "fire"
            ? "Local stock cannot cover the gap."
            : "Local stock cannot cover the sitio water request.",
        deliveryFeasibility: "Confirm access from Generoso St.",
        evidenceQuality: sample.aiReason,
      },
      vertexClass: sample.hazardHint === "fire" ? "fire" : null,
      vertexConfidence: sample.hazardHint === "fire" ? 0.88 : null,
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
      reporterEmail: sample.email,
      reporterPhone: sample.phone,
      reporterEmailVerified: false,
      trustScore: trust.total,
      trustBreakdown: trust,
      reactionCounts: { ...EMPTY_REACTION_COUNTS },
      commentCount: 0,
      updatedAt: now,
      updatedAtServer: serverTimestamp(),
    };

    if (existing.exists()) {
      const data = existing.data() as {
        citizenPurok?: string;
        title?: string;
        notes?: string;
        barangay?: string;
        status?: string;
      };
      // Keep fire create-only; refresh water sitio copy when it drifts.
      const waterDrift =
        sample.hazardHint === "other" &&
        (data.citizenPurok !== sample.sitio ||
          data.title !== sample.title ||
          data.notes !== sample.notes ||
          data.barangay !== "Apas" ||
          data.status !== "legit");
      if (!waterDrift) continue;
      await setDoc(
        ref,
        {
          ...row,
          createdAt: existing.data()?.createdAt ?? now,
          createdAtServer:
            existing.data()?.createdAtServer ?? serverTimestamp(),
        },
        { merge: true },
      );
      created += 1;
      continue;
    }

    await setDoc(ref, {
      ...row,
      createdAt: now,
      createdAtServer: serverTimestamp(),
    });
    created += 1;
  }
  return created;
}

async function ensureApasReports(): Promise<number> {
  const db = getClientDb();
  let created = 0;
  const now = new Date().toISOString();

  for (const sample of APAS_QUEUE_SAMPLES) {
    const ref = doc(db, "reports", sample.id);
    const existing = await getDoc(ref);
    if (existing.exists()) continue;

    const trust = computeReportTrust({
      registered: false,
      idVerified: false,
      email: sample.email,
      phone: sample.phone,
      emailVerified: false,
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 30,
      aiConfidence: sample.aiConfidence,
      aiVerdict:
        sample.status === "queued" ? "needs_review" : sample.status,
    });

    await setDoc(ref, {
      citizenUid: GUEST_UID,
      source: "web",
      citizenName: sample.citizenName,
      citizenPurok: sample.citizenPurok,
      barangay: "Apas",
      lgu: "Cebu City",
      citizenPhotoURL: null,
      title: sample.title,
      notes: sample.notes,
      hazardHint: sample.hazardHint,
      mediaType: "photo",
      mediaPath: sample.mediaUrl,
      mediaUrl: sample.mediaUrl,
      mediaMime: mimeForUrl(sample.mediaUrl),
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 30,
      locationLabel: `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`,
      device: "iPhone · Safari",
      ipAddress: null,
      status: sample.status,
      aiVerdict: sample.status === "queued" ? "needs_review" : sample.status,
      aiConfidence: sample.aiConfidence,
      aiReason: sample.aiReason,
      aiSource: "local",
      aiModel: "apas-sample-seed",
      aiPriority:
        sample.status === "rejected"
          ? "low"
          : sample.hazardHint === "flood" || sample.hazardHint === "fire"
            ? "high"
            : "medium",
      aiPriorityFactors: {
        immediateSeverity: "Apas sample seed.",
        peopleAffected: "Confirm on scene.",
        existingCoverage: "Check local stock.",
        deliveryFeasibility: "Confirm access.",
        evidenceQuality: sample.aiReason,
      },
      vertexClass: null,
      vertexConfidence: null,
      vertexLocationLabel: null,
      vertexLocationConfidence: null,
      vertexLocationPlaceId: null,
      vertexLocationPlaceLabel: null,
      validatedAt: sample.status === "queued" ? null : now,
      autoResponderCallAt: null,
      dispatchedAt: null,
      dispatchLog: null,
    manualDispatchChecked: false,
      fieldEvidence: [],
      reporterIdVerified: false,
      reporterEmail: sample.email,
      reporterPhone: sample.phone,
      reporterEmailVerified: false,
      trustScore: trust.total,
      trustBreakdown: trust,
      reactionCounts: { ...EMPTY_REACTION_COUNTS },
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
      createdAtServer: serverTimestamp(),
      updatedAtServer: serverTimestamp(),
    });
    created += 1;
  }
  return created;
}

/**
 * Idempotent Apas ops seed for production: households (append) + staff.
 * Does not clear Nangka / other barangay household rows.
 * Sample queue reports are opt-in (simulation / Cup demos only).
 */
export async function ensureApasOpsSeed(
  officerUid: string,
  opts?: { includeSampleReports?: boolean },
): Promise<{
  households: number;
  staff: number;
  reports: number;
  officers: number;
  evacCenters: number;
  partners: number;
  inventory: number;
  hall: typeof APAS_HALL;
  areaId: typeof APAS_AREA_ID;
}> {
  const [households, staff, queueReports, opsReports, evacCenters, partners, inventory] =
    await Promise.all([
      ensureApasHouseholds(officerUid),
      ensureApasStaff(),
      opts?.includeSampleReports ? ensureApasReports() : Promise.resolve(0),
      ensureApasWaterAndFireReports(),
      import("@/lib/evacCenters/api").then((m) => m.ensureApasEvacCenters()),
      import("@/lib/partners/api").then((m) => m.ensureApasPartners()),
      import("@/lib/inventory/api").then((m) =>
        m.ensureActiveBarangayInventory(),
      ),
    ]);
  const { ensureApasOfficers } = await import("@/lib/auth/ensureApasOfficers");
  const officerSeed = await ensureApasOfficers(officerUid, APAS_ORG_NAME);
  if (officerSeed.errors.length > 0) {
    console.warn("[apasSeed] officer auth partial", officerSeed.errors.slice(0, 3));
  }
  return {
    households,
    staff,
    reports: queueReports + opsReports,
    officers: officerSeed.officers,
    evacCenters,
    partners,
    inventory,
    hall: APAS_HALL,
    areaId: APAS_AREA_ID,
  };
}

export function isApasAreaId(areaId: string | null | undefined): boolean {
  return (areaId ?? "").trim().toLowerCase() === APAS_AREA_ID;
}
