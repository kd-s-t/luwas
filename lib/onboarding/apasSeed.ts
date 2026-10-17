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

/** Sample field reports pinned near Apas hall (Cebu City). */
export const APAS_QUEUE_SAMPLES: ApasSample[] = [
  {
    id: "CEB-CC-APAS-261016-8001",
    status: "needs_review",
    title: "Street flooding · Generoso St near hall",
    notes:
      "Knee-deep water after brief downpour. Cars still passing slowly. Depth unclear past the bend.",
    hazardHint: "flood",
    citizenName: "Guest · Nina V.",
    citizenPurok: "Purok 1",
    phone: "+63 917 400 2001",
    email: "nina.v@apas.pending.demo",
    lat: 10.3371,
    lng: 123.9045,
    mediaUrl: "/reports/flood-road-chapel.png",
    aiConfidence: 0.51,
    aiReason: "Flood wording vs glare · needs ground check.",
  },
  {
    id: "CEB-CC-APAS-261016-8002",
    status: "needs_review",
    title: "Smoke near chapel · wind toward houses",
    notes:
      "Smoke from vacant lot. No flame seen. Wind pushing toward Purok 2 homes.",
    hazardHint: "fire",
    citizenName: "Guest · Paolo M.",
    citizenPurok: "Purok 2",
    phone: "+63 917 400 2002",
    email: "paolo.m@apas.pending.demo",
    lat: 10.3368,
    lng: 123.9054,
    mediaUrl: "/reports/road-block-access-east.jpg",
    aiConfidence: 0.46,
    aiReason: "Smell/smoke only · hold for human confirmation.",
  },
  {
    id: "CEB-CC-APAS-261016-8003",
    status: "queued",
    title: "Fallen branch on wires · north lane",
    notes: "Branch resting on secondary line after wind. No sparks yet.",
    hazardHint: "typhoon",
    citizenName: "Guest · Irene C.",
    citizenPurok: "Purok 3",
    phone: "+63 917 400 2003",
    email: "irene.c@apas.pending.demo",
    lat: 10.3381,
    lng: 123.9046,
    mediaUrl: "/reports/fallen-tree-access-road.webp",
    aiConfidence: 0.58,
    aiReason: "Tree vs line hazard mix · mid confidence.",
  },
  {
    id: "CEB-CC-APAS-261016-8004",
    status: "needs_review",
    title: "Evac center capacity claim unverified",
    notes:
      "Families asking if Apas hall can take overflow from nearby sites.",
    hazardHint: "evac",
    citizenName: "Guest · Carla O.",
    citizenPurok: "Purok 4",
    phone: "+63 917 400 2004",
    email: "carla.o@apas.pending.demo",
    lat: 10.3374,
    lng: 123.9049,
    mediaUrl: "/reports/ec-consolacion-1.jpg",
    aiConfidence: 0.49,
    aiReason: "Capacity claim unverified · needs ops count.",
  },
  {
    id: "CEB-CC-APAS-261016-8101",
    status: "rejected",
    title: "Complaint about neighbor karaoke",
    notes: "Loud music since 11pm. Not a disaster.",
    hazardHint: "other",
    citizenName: "Guest · Prank Apas",
    citizenPurok: "Purok 5",
    phone: "+63 900 222 0001",
    email: "prank@apas.reject.demo",
    lat: 10.3377,
    lng: 123.9058,
    mediaUrl: "/reports/free-wifi-nangka.png",
    aiConfidence: 0.95,
    aiReason: "Out of scope for hazard queue · rejected.",
  },
];

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
  hall: typeof APAS_HALL;
  areaId: typeof APAS_AREA_ID;
}> {
  const [households, staff, reports] = await Promise.all([
    ensureApasHouseholds(officerUid),
    ensureApasStaff(),
    opts?.includeSampleReports ? ensureApasReports() : Promise.resolve(0),
  ]);
  const { ensureApasOfficers } = await import("@/lib/auth/ensureApasOfficers");
  const officerSeed = await ensureApasOfficers(officerUid, APAS_ORG_NAME);
  if (officerSeed.errors.length > 0) {
    console.warn("[apasSeed] officer auth partial", officerSeed.errors.slice(0, 3));
  }
  return {
    households,
    staff,
    reports,
    officers: officerSeed.officers,
    hall: APAS_HALL,
    areaId: APAS_AREA_ID,
  };
}

export function isApasAreaId(areaId: string | null | undefined): boolean {
  return (areaId ?? "").trim().toLowerCase() === APAS_AREA_ID;
}
