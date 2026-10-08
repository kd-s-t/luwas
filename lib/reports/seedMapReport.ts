import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { DEMO_CITIZENS, type DemoCitizen } from "@/lib/auth/demoAccount";
import { getClientDb } from "@/lib/firebase/client";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import type { HazardReport, ReportHazardHint } from "@/lib/reports/types";
import type { ScenarioReportPin } from "@/lib/scenarios/types";
import { CAT5_DURING } from "@/lib/scenarios";

/** Firestore seed author uid (rules allow rpt-* creates for this uid). */
const SEED_UID = "demo-map-seed";

function hazardForKind(kind: ScenarioReportPin["kind"]): ReportHazardHint {
  if (kind === "flood") return "flood";
  if (kind === "fire") return "fire";
  if (kind === "landslide") return "landslide";
  if (kind === "blockage") return "typhoon";
  return "other";
}

function mimeForUrl(url: string): string {
  if (url.endsWith(".webp")) return "image/webp";
  if (url.endsWith(".png")) return "image/png";
  if (url.endsWith(".jpg") || url.endsWith(".jpeg")) return "image/jpeg";
  return "image/webp";
}

/** Pick a demo citizen whose purok matches the pin (or nearest purok number). */
export function nearbyCitizenForPin(pin: ScenarioReportPin): DemoCitizen {
  const exact = DEMO_CITIZENS.find(
    (c) => c.purok.toLowerCase() === pin.purokHint.toLowerCase(),
  );
  if (exact) return exact;

  const n = Number(pin.purokHint.replace(/\D+/g, ""));
  if (Number.isFinite(n) && n > 0) {
    const byNum = DEMO_CITIZENS.find((c) => c.purok.includes(String(n)));
    if (byNum) return byNum;
    // Purok 6+ → closest demo (Purok 5 Marco)
    const idx = Math.min(DEMO_CITIZENS.length - 1, Math.max(0, n - 1));
    return DEMO_CITIZENS[idx]!;
  }

  // Stable fallback from pin id
  let h = 0;
  for (const ch of pin.id) h = (h + ch.charCodeAt(0)) % DEMO_CITIZENS.length;
  return DEMO_CITIZENS[h]!;
}

/** Lookup curated map pin by id (for ensure-seed). */
export function findMapReportPin(id: string): ScenarioReportPin | undefined {
  return CAT5_DURING.reportPins.find((p) => p.id === id);
}

/** Curated map image reports that should appear in the public feed. */
export function listMapReportPinsWithMedia(): ScenarioReportPin[] {
  return CAT5_DURING.reportPins.filter((p) => Boolean(p.mediaUrl));
}

/** Create-if-missing for every map image report (fallen tree, flood road, …). */
export async function ensureAllMapReportsInDb(): Promise<void> {
  const pins = listMapReportPinsWithMedia();
  await Promise.all(pins.map((pin) => ensureMapReportInDb(pin)));
}

/**
 * Ensure a map image-report exists in Firestore.
 * Creates from the curated pin + public media if missing.
 * Author is a nearby demo citizen (by purok), not "Field reporter".
 */
export async function ensureMapReportInDb(
  pin: ScenarioReportPin,
): Promise<HazardReport> {
  if (!pin.mediaUrl) {
    throw new Error("Pin has no mediaUrl to seed");
  }

  const citizen = nearbyCitizenForPin(pin);
  const ref = doc(getClientDb(), "reports", pin.id);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();
    const staleName =
      !data.citizenName ||
      data.citizenName === "Field reporter" ||
      data.citizenName === "Map seed";

    if (
      staleName ||
      data.citizenPurok !== citizen.purok ||
      data.barangay !== DEFAULT_REPORT_BARANGAY ||
      data.lgu !== DEFAULT_REPORT_LGU ||
      data.lat !== pin.lat ||
      data.lng !== pin.lng ||
      data.title !== pin.title ||
      data.notes !== pin.notes
    ) {
      await updateDoc(ref, {
        citizenName: citizen.displayName,
        citizenPurok: citizen.purok,
        barangay: DEFAULT_REPORT_BARANGAY,
        lgu: DEFAULT_REPORT_LGU,
        title: pin.title,
        notes: pin.notes,
        lat: pin.lat,
        lng: pin.lng,
        locationLabel: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      });
    }

    return {
      id: pin.id,
      citizenUid: String(data.citizenUid ?? SEED_UID),
      citizenName: citizen.displayName,
      citizenPurok: citizen.purok,
      barangay: DEFAULT_REPORT_BARANGAY,
      lgu: DEFAULT_REPORT_LGU,
      citizenPhotoURL:
        data.citizenPhotoURL != null ? String(data.citizenPhotoURL) : null,
      title: String(data.title ?? pin.title),
      notes: String(data.notes ?? pin.notes),
      hazardHint: (data.hazardHint as ReportHazardHint) ?? hazardForKind(pin.kind),
      mediaType: "photo",
      mediaPath: String(data.mediaPath ?? pin.mediaUrl),
      mediaUrl: String(data.mediaUrl ?? pin.mediaUrl),
      mediaMime: String(data.mediaMime ?? mimeForUrl(pin.mediaUrl)),
      mediaSource:
        (data.mediaSource as HazardReport["mediaSource"]) ?? "mobile-camera",
      lat: typeof data.lat === "number" ? data.lat : pin.lat,
      lng: typeof data.lng === "number" ? data.lng : pin.lng,
      locationAccuracyM:
        typeof data.locationAccuracyM === "number"
          ? data.locationAccuracyM
          : null,
      locationLabel:
        data.locationLabel != null
          ? String(data.locationLabel)
          : `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
      device: data.device != null ? String(data.device) : "Android · mobile",
      ipAddress: data.ipAddress != null ? String(data.ipAddress) : null,
      status: (data.status as HazardReport["status"]) ?? "legit",
      aiVerdict: (data.aiVerdict as HazardReport["aiVerdict"]) ?? "legit",
      aiConfidence:
        typeof data.aiConfidence === "number" ? data.aiConfidence : 0.9,
      aiReason: data.aiReason != null ? String(data.aiReason) : pin.sourceLabel,
      aiSource: (data.aiSource as HazardReport["aiSource"]) ?? "local",
      aiModel: data.aiModel != null ? String(data.aiModel) : null,
      validatedAt:
        data.validatedAt != null ? String(data.validatedAt) : pin.reportedAt,
      reactionCounts: {
        like: Number(
          (data.reactionCounts as { like?: number } | undefined)?.like ?? 0,
        ),
        helpful: Number(
          (data.reactionCounts as { helpful?: number } | undefined)?.helpful ??
            0,
        ),
        concern: Number(
          (data.reactionCounts as { concern?: number } | undefined)?.concern ??
            0,
        ),
      },
      commentCount: Number(data.commentCount ?? 0),
      createdAt: String(data.createdAt ?? pin.reportedAt),
      updatedAt: String(data.updatedAt ?? pin.reportedAt),
    };
  }

  const now = new Date().toISOString();
  const row = {
    citizenUid: SEED_UID,
    citizenName: citizen.displayName,
    citizenPurok: citizen.purok,
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
    citizenPhotoURL: null,
    title: pin.title,
    notes: pin.notes,
    hazardHint: hazardForKind(pin.kind),
    mediaType: "photo" as const,
    mediaPath: pin.mediaUrl,
    mediaUrl: pin.mediaUrl,
    mediaMime: mimeForUrl(pin.mediaUrl),
    mediaSource: "mobile-camera" as const,
    lat: pin.lat,
    lng: pin.lng,
    locationAccuracyM: null,
    locationLabel: `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}`,
    device: "Android · mobile",
    ipAddress: null,
    status: "legit" as const,
    aiVerdict: "legit" as const,
    aiConfidence: 0.92,
    aiReason: "Seeded from map image report",
    aiSource: "local" as const,
    aiModel: null,
    validatedAt: pin.reportedAt,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    createdAt: pin.reportedAt,
    updatedAt: now,
    createdAtServer: serverTimestamp(),
    updatedAtServer: serverTimestamp(),
  };

  await setDoc(ref, row);

  return {
    id: pin.id,
    ...row,
    citizenPhotoURL: null,
    aiModel: null,
  };
}
