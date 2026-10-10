import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { runLocalValidate } from "@/lib/reports/localValidate";
import {
  DEFAULT_REPORT_BARANGAY,
  DEFAULT_REPORT_LGU,
} from "@/lib/reports/barangayScope";
import { EMPTY_REACTION_COUNTS } from "@/lib/reports/socialTypes";
import { computeReportTrust } from "@/lib/reports/trustScore";
import type { ReportHazardHint, ReportStatus } from "@/lib/reports/types";

export const runtime = "nodejs";

type Body = {
  reference?: string;
  situation?: string;
  placeLabel?: string;
  landmark?: string;
  latitude?: number | null;
  longitude?: number | null;
  approximateLocation?: boolean;
  mobileNumber?: string;
  photoNames?: string[];
  intent?: string;
  aiCategory?: string;
  aiVerdict?: string;
  aiConfidence?: number;
  aiReason?: string;
  citizenName?: string;
  citizenPurok?: string;
  /** `ios` (default) or `web` guest — no login. */
  source?: string;
  /** Optional photo from web guest (base64, no data: prefix). */
  mediaBase64?: string;
  mediaMime?: string;
};

function hazardFromText(text: string, category?: string): ReportHazardHint {
  const t = `${text} ${category ?? ""}`.toLowerCase();
  if (t.includes("flood") || t.includes("baha")) return "flood";
  if (t.includes("landslide") || t.includes("guho") || t.includes("gusaw"))
    return "landslide";
  if (t.includes("fire") || t.includes("sunog")) return "fire";
  if (
    t.includes("typhoon") ||
    t.includes("bagyo") ||
    t.includes("odette") ||
    t.includes("wind")
  )
    return "typhoon";
  if (t.includes("evac") || t.includes("shelter")) return "evac";
  return "other";
}

/** Reuse assets already shipped under public/reports/. */
function mediaForHazard(hazard: ReportHazardHint): {
  mediaUrl: string;
  mediaMime: string;
} {
  switch (hazard) {
    case "flood":
    case "typhoon":
      return {
        mediaUrl: "/reports/flood-road-chapel.png",
        mediaMime: "image/png",
      };
    case "landslide":
      return {
        mediaUrl: "/reports/landslide-bank-failure.png",
        mediaMime: "image/png",
      };
    case "evac":
      return {
        mediaUrl: "/reports/ec-consolacion-1.jpg",
        mediaMime: "image/jpeg",
      };
    case "fire":
      return {
        mediaUrl: "/reports/fallen-tree-access-road.webp",
        mediaMime: "image/webp",
      };
    default:
      return {
        mediaUrl: "/reports/road-block-access-east.jpg",
        mediaMime: "image/jpeg",
      };
  }
}

function firestoreHost(): string {
  const useEmu = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  return (
    process.env.FIRESTORE_EMULATOR_HOST?.trim() ||
    (useEmu ? "127.0.0.1:8080" : "")
  );
}

function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "demo-dro";
}

/** Write a document via Firestore REST — works on emulator and bypasses Auth. */
async function putReportDoc(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const host = firestoreHost();
  if (!host) {
    throw new Error(
      "Firestore emulator not configured (set NEXT_PUBLIC_USE_EMULATORS=true)",
    );
  }

  const url =
    `http://${host}/v1/projects/${projectId()}/databases/(default)/documents/reports/` +
    encodeURIComponent(id);

  // Emulator: Bearer owner bypasses security rules so iOS ingest always persists.
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner",
    },
    body: JSON.stringify({ fields: encodeFields(fields) }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore write ${res.status}: ${text.slice(0, 400)}`);
  }

  // Verify the doc is readable from the database.
  const check = await fetch(url);
  if (!check.ok) {
    throw new Error(`Firestore verify failed after write (${check.status})`);
  }
}

function encodeValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v) => encodeValue(v)),
      },
    };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function encodeFields(
  fields: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = encodeValue(v);
  }
  return out;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const situation =
    typeof body.situation === "string" ? body.situation.trim() : "";
  if (situation.length < 12) {
    return NextResponse.json(
      { error: "situation required (min 12 chars)" },
      { status: 400 },
    );
  }

  const referenceRaw =
    typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  const reference = /^LUW-\d{6}-\d{4}$/.test(referenceRaw)
    ? referenceRaw
    : (() => {
        const day = new Date().toISOString().slice(2, 10).replace(/-/g, "");
        const suffix = String(Math.floor(1000 + Math.random() * 9000));
        return `LUW-${day}-${suffix}`;
      })();

  const placeLabel =
    typeof body.placeLabel === "string" && body.placeLabel.trim()
      ? body.placeLabel.trim()
      : `Brgy. ${DEFAULT_REPORT_BARANGAY}, ${DEFAULT_REPORT_LGU}`;
  const landmark =
    typeof body.landmark === "string" ? body.landmark.trim() : "";
  const lat = typeof body.latitude === "number" ? body.latitude : null;
  const lng = typeof body.longitude === "number" ? body.longitude : null;
  const phone =
    typeof body.mobileNumber === "string" ? body.mobileNumber.trim() : "";
  const photoNames = Array.isArray(body.photoNames)
    ? body.photoNames.map(String).filter(Boolean)
    : [];
  const source = body.source === "web" ? "web" : "ios";
  const citizenUid = source === "web" ? "web-guest" : "ios-guest";
  const citizenName =
    typeof body.citizenName === "string" && body.citizenName.trim()
      ? body.citizenName.trim()
      : source === "web"
        ? "Guest"
        : "iOS guest";
  const citizenPurok =
    typeof body.citizenPurok === "string" && body.citizenPurok.trim()
      ? body.citizenPurok.trim()
      : source === "web"
        ? "No login"
        : "Field";

  const hazardHint = hazardFromText(situation, body.aiCategory);
  const title =
    body.intent === "needHelp"
      ? `Help needed · ${placeLabel}`
      : `Hazard · ${placeLabel}`;
  const notes = [situation, landmark ? `Landmark: ${landmark}` : ""]
    .filter(Boolean)
    .join("\n\n");

  const mediaMimeRaw =
    typeof body.mediaMime === "string" && body.mediaMime.trim()
      ? body.mediaMime.trim()
      : "image/jpeg";
  const local = runLocalValidate({
    title,
    notes,
    hazardHint,
    mediaType: "photo",
    mediaMime: mediaMimeRaw,
    fileName: photoNames[0] ?? `${source}-photo.jpg`,
  });

  let aiVerdict: "legit" | "rejected" | "needs_review" = local.verdict;
  let aiConfidence = local.confidence;
  const aiReason = body.aiReason?.trim() || local.reason;

  const rawVerdict = body.aiVerdict;
  if (
    rawVerdict === "legit" ||
    rawVerdict === "rejected" ||
    rawVerdict === "needs_review" ||
    rawVerdict === "needsReview"
  ) {
    aiVerdict = rawVerdict === "needsReview" ? "needs_review" : rawVerdict;
    if (typeof body.aiConfidence === "number") {
      aiConfidence = Math.max(0, Math.min(1, body.aiConfidence));
    }
  }

  // Officer QUEUE tab: queued | validating | needs_review | failed
  const status: ReportStatus =
    aiVerdict === "rejected"
      ? "rejected"
      : aiVerdict === "needs_review"
        ? "needs_review"
        : "queued";

  const trust = computeReportTrust({
    registered: false,
    idVerified: false,
    email: null,
    phone: phone || null,
    emailVerified: false,
    mediaSource: "mobile-camera",
    lat,
    lng,
    locationAccuracyM: body.approximateLocation ? 120 : 35,
    aiConfidence,
    aiVerdict,
  });

  const now = new Date().toISOString();
  let mediaUrl: string;
  let mediaMime: string;
  let mediaPath: string;

  const rawB64 =
    typeof body.mediaBase64 === "string" ? body.mediaBase64.trim() : "";
  if (rawB64 && source === "web") {
    const ext =
      mediaMimeRaw.includes("png")
        ? "png"
        : mediaMimeRaw.includes("webp")
          ? "webp"
          : mediaMimeRaw.includes("gif")
            ? "gif"
            : "jpg";
    const relDir = path.join("reports", "guest");
    const fileName = `${reference}.${ext}`;
    const absDir = path.join(process.cwd(), "public", relDir);
    await mkdir(absDir, { recursive: true });
    await writeFile(path.join(absDir, fileName), Buffer.from(rawB64, "base64"));
    mediaUrl = `/${relDir}/${fileName}`;
    mediaMime = mediaMimeRaw;
    mediaPath = mediaUrl;
  } else {
    const stock = mediaForHazard(hazardHint);
    mediaUrl = stock.mediaUrl;
    mediaMime = stock.mediaMime;
    mediaPath = mediaUrl;
  }

  const payload: Record<string, unknown> = {
    citizenUid,
    citizenName,
    citizenPurok,
    barangay: DEFAULT_REPORT_BARANGAY,
    lgu: DEFAULT_REPORT_LGU,
    citizenPhotoURL: null,
    title,
    notes,
    hazardHint,
    mediaType: "photo",
    mediaPath,
    mediaUrl,
    mediaMime,
    mediaSource: source === "web" ? "desktop-file" : "mobile-camera",
    lat,
    lng,
    locationAccuracyM: body.approximateLocation ? 120 : 35,
    locationLabel: placeLabel,
    device: source === "web" ? "web-luwas-citizen" : "ios-luwas-citizen",
    ipAddress: null,
    reporterIdVerified: false,
    reporterEmail: null,
    reporterPhone: phone || null,
    reporterEmailVerified: false,
    trustScore: trust.total,
    trustBreakdown: {
      identity: trust.identity,
      contact: trust.contact,
      capture: trust.capture,
      ai: trust.ai,
      total: trust.total,
    },
    status,
    aiVerdict,
    aiConfidence,
    aiReason: `[${source}] ${aiReason}`,
    aiSource: "local",
    aiModel: `${source}-local-rules`,
    validatedAt: now,
    reactionCounts: { ...EMPTY_REACTION_COUNTS },
    commentCount: 0,
    source,
    iosReference: reference,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await putReportDoc(reference, payload);
  } catch (err) {
    console.error("[ios-ingest] Firestore write failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to write report to Firestore",
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    id: reference,
    status,
    aiVerdict,
    saved: true,
    database: `firestore://${projectId()}/reports/${reference}`,
    message: "Report saved to Firestore and queued for barangay review",
  });
}
