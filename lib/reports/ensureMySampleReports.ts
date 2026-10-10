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
import { computeReportTrust } from "@/lib/reports/trustScore";
import type { ReportHazardHint, ReportStatus } from "@/lib/reports/types";

type MySample = {
  suffix: string;
  status: Extract<
    ReportStatus,
    "queued" | "needs_review" | "legit" | "rejected"
  >;
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaUrl: string;
  lat: number;
  lng: number;
  aiConfidence: number;
  aiReason: string;
};

const SAMPLES: MySample[] = [
  {
    suffix: "01",
    status: "needs_review",
    title: "Floodwater rising · Purok 6 Access Road",
    notes:
      "Knee-deep water near the corner by Ken’s house. Cars still trying to pass.",
    hazardHint: "flood",
    mediaUrl: "/reports/flood-road-chapel.png",
    lat: 10.3692,
    lng: 123.9623,
    aiConfidence: 0.51,
    aiReason: "Needs ground check · depth unclear from photo.",
  },
  {
    suffix: "02",
    status: "queued",
    title: "Fallen branch blocking lane",
    notes: "Large branch on Access Road east. One lane open.",
    hazardHint: "typhoon",
    mediaUrl: "/reports/fallen-tree-access-road.webp",
    lat: 10.3704,
    lng: 123.9615,
    aiConfidence: 0.4,
    aiReason: "Queued for AI validation.",
  },
  {
    suffix: "03",
    status: "legit",
    title: "Landslide crack · hillside path",
    notes: "Soil fissure after rain. Neighbors advised to avoid the footpath.",
    hazardHint: "landslide",
    mediaUrl: "/reports/landslide-bank-failure.png",
    lat: 10.3711,
    lng: 123.9608,
    aiConfidence: 0.86,
    aiReason: "Verified · slope risk consistent with photo.",
  },
  {
    suffix: "04",
    status: "legit",
    title: "Road blocked · east access",
    notes: "Debris pile after wind. Passable on foot only.",
    hazardHint: "typhoon",
    mediaUrl: "/reports/road-block-access-east.jpg",
    lat: 10.3709,
    lng: 123.9598,
    aiConfidence: 0.9,
    aiReason: "Verified · blockage clear in media.",
  },
  {
    suffix: "05",
    status: "rejected",
    title: "Test ping · ignore",
    notes: "Sample reject for demo queue.",
    hazardHint: "other",
    mediaUrl: "/reports/free-wifi-nangka.png",
    lat: 10.3702,
    lng: 123.9595,
    aiConfidence: 0.95,
    aiReason: "Rejected · non-hazard test content.",
  },
];

function mimeForUrl(url: string): string {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

/**
 * Seed 5 sample field reports owned by the signed-in user (My reports).
 * Ids: rpt-mine-{uid}-{suffix}
 */
export async function ensureMySampleReports(input: {
  uid: string;
  displayName: string;
  purok?: string;
  email?: string | null;
  phone?: string | null;
  photoURL?: string | null;
  idVerified?: boolean;
}): Promise<{ created: number; skipped: number }> {
  const uid = input.uid.trim();
  if (!uid) return { created: 0, skipped: 0 };

  const db = getClientDb();
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();
  const purok = input.purok?.trim() || "Purok 6";

  for (const sample of SAMPLES) {
    const id = `rpt-mine-${uid}-${sample.suffix}`;
    const ref = doc(db, "reports", id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      skipped += 1;
      continue;
    }

    const trust = computeReportTrust({
      registered: true,
      idVerified: Boolean(input.idVerified),
      email: input.email,
      phone: input.phone,
      emailVerified: true,
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 28,
      aiConfidence: sample.aiConfidence,
      aiVerdict:
        sample.status === "queued"
          ? null
          : sample.status === "legit"
            ? "legit"
            : sample.status === "rejected"
              ? "rejected"
              : "needs_review",
    });

    await setDoc(ref, {
      citizenUid: uid,
      citizenName: input.displayName,
      citizenPurok: purok,
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
      citizenPhotoURL: input.photoURL ?? null,
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
      device: "iPhone · Safari",
      ipAddress: null,
      status: sample.status,
      aiVerdict:
        sample.status === "queued"
          ? null
          : sample.status === "legit"
            ? "legit"
            : sample.status === "rejected"
              ? "rejected"
              : "needs_review",
      aiConfidence:
        sample.status === "queued" ? null : sample.aiConfidence,
      aiReason: sample.aiReason,
      aiSource: sample.status === "queued" ? null : "local",
      aiModel: sample.status === "queued" ? null : "sample-seed",
      validatedAt: sample.status === "queued" ? null : now,
      reporterIdVerified: Boolean(input.idVerified),
      reporterEmail: input.email?.trim() || null,
      reporterPhone: input.phone?.trim() || null,
      reporterEmailVerified: true,
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

  return { created, skipped };
}
