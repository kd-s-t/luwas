import { NextResponse } from "next/server";
import {
  firestoreEmulatorHost,
  uploadGuestMediaBytes,
} from "@/lib/reports/serverGuestWrite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const LEGACY_GUEST_REPORT_ID = /^LUW-\d{6}-\d{4}$/;
const PLACE_GUEST_REPORT_ID =
  /^[A-Z]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{2,10}-\d{6}-\d{4}$/;
const CITIZEN_UID = /^[A-Za-z0-9_-]{6,128}$/;
const REPORT_ID = /^[A-Za-z0-9_-]{8,128}$/;

function isGuestReportId(id: string): boolean {
  const raw = id.toUpperCase();
  return LEGACY_GUEST_REPORT_ID.test(raw) || PLACE_GUEST_REPORT_ID.test(raw);
}

/**
 * Report media upload. Guests use place ids CEB-CON-NANG-* (or legacy LUW-*).
 * Signed-in users pass citizenUid + report id (path reports/{uid}/{id}/...).
 * kind=field stores unique on-site photos (images only).
 * Uses ADC on prod so the browser never talks to GCS (avoids Storage CORS).
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const reportIdRaw = form.get("reportId");
  const reportId =
    typeof reportIdRaw === "string" ? reportIdRaw.trim() : "";
  const citizenUidRaw = form.get("citizenUid");
  const citizenUid =
    typeof citizenUidRaw === "string" ? citizenUidRaw.trim() : "";

  const kindRaw = form.get("kind");
  const kind =
    kindRaw === "voice" ? "voice" : kindRaw === "field" ? "field" : "photo";

  const isGuest = isGuestReportId(reportId);
  const guestReportId = isGuest ? reportId.toUpperCase() : "";
  const hasUploader = CITIZEN_UID.test(citizenUid);
  const isCitizen =
    !isGuest && hasUploader && REPORT_ID.test(reportId);
  /** Officer field photos on guest/place reports (CEB-CON-NANG-*). */
  const isFieldOnGuest = kind === "field" && isGuest && hasUploader;

  if (kind === "field" && !isCitizen && !isFieldOnGuest) {
    return NextResponse.json(
      { error: "field photos require signed-in uploader" },
      { status: 400 },
    );
  }

  if (!isGuest && !isCitizen && !isFieldOnGuest) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > 28 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  if (kind === "field" && !contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Images only" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const extFromName = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase().replace(/[^\w]/g, "")
    : "";
  const ext =
    extFromName ||
    (contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : contentType.includes("webm")
            ? "webm"
            : contentType.includes("ogg")
              ? "ogg"
              : contentType.includes("mp4") || contentType.includes("aac")
                ? "m4a"
                : kind === "voice"
                  ? "webm"
                  : "jpg");

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fieldReportKey = isFieldOnGuest ? guestReportId : reportId;
  const objectPath =
    kind === "field"
      ? `reports/${citizenUid}/${fieldReportKey}/field/${stamp}.${ext}`
      : isGuest
        ? `reports/web-guest/${guestReportId}/${kind}.${ext}`
        : `reports/${citizenUid}/${reportId}/${kind}.${ext}`;

  try {
    if (firestoreEmulatorHost()) {
      const relDir =
        kind === "field"
          ? path.join("reports", citizenUid, fieldReportKey, "field")
          : isGuest
            ? path.join("reports", "guest")
            : path.join("reports", citizenUid, reportId);
      const fileName =
        kind === "field"
          ? `${stamp}.${ext}`
          : isGuest
            ? `${guestReportId}-${kind}.${ext}`
            : `${kind}.${ext}`;
      const absDir = path.join(process.cwd(), "public", relDir);
      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, fileName), bytes);
      const mediaUrl = `/${relDir}/${fileName}`.replace(/\\/g, "/");
      return NextResponse.json({
        ok: true,
        mediaPath: mediaUrl,
        mediaUrl,
        mediaMime: contentType,
      });
    }

    const uploaded = await uploadGuestMediaBytes({
      objectPath,
      bytes,
      contentType,
    });
    return NextResponse.json({
      ok: true,
      mediaPath: uploaded.mediaPath,
      mediaUrl: uploaded.mediaUrl,
      mediaMime: contentType,
    });
  } catch (err) {
    console.error("[guest-upload] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Guest media upload failed",
      },
      { status: 502 },
    );
  }
}
