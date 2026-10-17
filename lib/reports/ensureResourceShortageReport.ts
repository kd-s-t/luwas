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
 * Demo incidents for Resources → Find assistance.
 * Verified flood + empty local stock → shortage card.
 * Place id is canonical; rpt-* kept so older /admin/incidents/rpt-resource-* links work.
 */
export const RESOURCE_SHORTAGE_REPORT_ID = `${NANGKA_REPORT_PREFIX}-261017-9201`;
export const RESOURCE_SHORTAGE_REPORT_ID_LEGACY = "rpt-resource-nangka-flood";

const RESOURCE_SHORTAGE_IDS = [
  RESOURCE_SHORTAGE_REPORT_ID,
  RESOURCE_SHORTAGE_REPORT_ID_LEGACY,
] as const;

function buildRow(now: string) {
  const lat = 10.3694;
  const lng = 123.9621;
  const email = "rosa.villanueva@nangka.resource.demo";
  const phone = "+63 917 200 9201";
  const trust = computeReportTrust({
    registered: true,
    idVerified: true,
    email,
    phone,
    emailVerified: true,
    mediaSource: "mobile-camera",
    lat,
    lng,
    locationAccuracyM: 28,
    aiConfidence: 0.91,
    aiVerdict: "legit",
  });

  return {
    citizenUid: SEED_UID,
    citizenName: "Rosa V.",
    citizenPurok: "Purok 6",
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
    citizenPhotoURL: null,
    title: "Flood · Purok 6 · food and water shortage",
    notes:
      "Families stranded overnight. Need 40 food packs and 200 L water for 12 households. Local stock empty.",
    hazardHint: "flood" as const,
    mediaType: "photo" as const,
    mediaPath: "/reports/flood-road-chapel.png",
    mediaUrl: "/reports/flood-road-chapel.png",
    mediaMime: "image/png",
    mediaSource: "mobile-camera" as const,
    lat,
    lng,
    locationAccuracyM: 28,
    locationLabel: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit" as const,
    aiVerdict: "legit" as const,
    aiConfidence: 0.91,
    aiReason: "Verified · flood + supply gap for Resources desk demo.",
    aiSource: "local" as const,
      aiModel: "resource-seed",
      aiPriority: "high",
      aiPriorityFactors: {
        immediateSeverity: "Flood shortage · households need food and water.",
        peopleAffected: "Multiple households indicated in the shortage claim.",
        existingCoverage: "Local stock cannot cover the gap.",
        deliveryFeasibility: "Road access assumed open pending field check.",
        evidenceQuality: "Seeded verified shortage for Resources desk demos.",
      },
    vertexClass: null,
    vertexConfidence: null,
    validatedAt: now,
    autoResponderCallAt: null,
    dispatchedAt: null,
    dispatchLog: null,
    manualDispatchChecked: false,
    fieldEvidence: [],
    reporterIdVerified: true,
    reporterEmail: email,
    reporterPhone: phone,
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
 * Create-or-repair legit flood reports that force a Resources shortage.
 */
export async function ensureResourceShortageReport(): Promise<{
  id: string;
  created: number;
  repaired: number;
}> {
  const db = getClientDb();
  const now = new Date().toISOString();
  const row = buildRow(now);
  let created = 0;
  let repaired = 0;

  for (const id of RESOURCE_SHORTAGE_IDS) {
    const ref = doc(db, "reports", id);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, row);
      created += 1;
      continue;
    }
    const data = existing.data() as { status?: string; notes?: string };
    if (data.status !== "legit" || !/food packs|200 L/i.test(data.notes ?? "")) {
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
  }

  return { id: RESOURCE_SHORTAGE_REPORT_ID, created, repaired };
}
