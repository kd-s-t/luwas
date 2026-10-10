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

/** Guest seed author — matches firestore.rules LUW-* create path. */
const GUEST_UID = "web-guest";

type SampleReport = {
  id: string;
  status: Extract<ReportStatus, "needs_review" | "rejected">;
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

/**
 * 5 needs_review (human intervention) + 5 rejected sample field reports.
 * IDs use LUW-YYMMDD-#### so guest create rules apply.
 */
export const QUEUE_SAMPLE_REPORTS: SampleReport[] = [
  // —— Pending · needs human intervention ——
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
    title: "Tree leaning on wires · Access Road east",
    notes:
      "Large branch over power line. Sparks not confirmed. Traffic still passing.",
    hazardHint: "typhoon",
    citizenName: "Guest · Elena C.",
    citizenPurok: "Purok 1",
    phone: "+63 917 200 1003",
    email: "elena.cruz@nangka.pending.demo",
    lat: 10.3704,
    lng: 123.9615,
    mediaUrl: "/reports/fallen-tree-access-road.webp",
    aiConfidence: 0.55,
    aiReason:
      "Hazard type mixed (tree vs. line) · confidence mid; escalate to tanod check.",
  },
  {
    id: "LUW-261011-9004",
    status: "needs_review",
    title: "Smoke smell · near chapel road",
    notes:
      "Smell of smoke, no visible flame. Could be cooking fire or debris burn.",
    hazardHint: "fire",
    citizenName: "Guest · Rico A.",
    citizenPurok: "Purok 3",
    phone: "+63 917 200 1004",
    email: "rico.alonzo@nangka.pending.demo",
    lat: 10.3709,
    lng: 123.9598,
    mediaUrl: "/reports/road-block-access-east.jpg",
    aiConfidence: 0.41,
    aiReason:
      "No flame in media · smell-only report; hold for human confirmation.",
  },
  {
    id: "LUW-261011-9005",
    status: "needs_review",
    title: "EC crowding · Consolacion center #1",
    notes:
      "Families arriving; unclear if beds remain. Asking if hall can take overflow.",
    hazardHint: "evac",
    citizenName: "Guest · Sarah L.",
    citizenPurok: "Purok 2",
    phone: "+63 917 200 1005",
    email: "sarah.lim@nangka.pending.demo",
    lat: 10.372,
    lng: 123.9585,
    mediaUrl: "/reports/ec-consolacion-1.jpg",
    aiConfidence: 0.5,
    aiReason:
      "Capacity claim unverified · needs ops count before public status update.",
  },
  // —— Rejected samples ——
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

function mimeForUrl(url: string): string {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

/**
 * Upsert sample queue + rejected reports (create-if-missing).
 * Does not overwrite rows already decided by an officer.
 */
export async function ensureQueueSampleReports(): Promise<{
  created: number;
  skipped: number;
}> {
  const db = getClientDb();
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const sample of QUEUE_SAMPLE_REPORTS) {
    const ref = doc(db, "reports", sample.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      skipped += 1;
      continue;
    }

    const trust = computeReportTrust({
      registered: false,
      idVerified: false,
      email: sample.email,
      phone: sample.phone,
      emailVerified: false,
      mediaSource: "mobile-camera",
      lat: sample.lat,
      lng: sample.lng,
      locationAccuracyM: 35,
      aiConfidence: sample.aiConfidence,
      aiVerdict: sample.status,
    });

    await setDoc(ref, {
      citizenUid: GUEST_UID,
      source: "web",
      citizenName: sample.citizenName,
      citizenPurok: sample.citizenPurok,
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
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
      locationAccuracyM: 35,
      locationLabel: `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`,
      device: "iPhone · Safari",
      ipAddress: null,
      status: sample.status,
      aiVerdict: sample.status,
      aiConfidence: sample.aiConfidence,
      aiReason: sample.aiReason,
      aiSource: "local",
      aiModel: "sample-seed",
      validatedAt: now,
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

  return { created, skipped };
}
