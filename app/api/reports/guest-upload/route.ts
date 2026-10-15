import { NextResponse } from "next/server";
import {
  firestoreEmulatorHost,
  uploadGuestMediaBytes,
} from "@/lib/reports/serverGuestWrite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

/**
 * Guest media upload (no login). Uses ADC on prod; local public/ under emulators.
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
    typeof reportIdRaw === "string" ? reportIdRaw.trim().toUpperCase() : "";
  if (!/^LUW-\d{6}-\d{4}$/.test(reportId)) {
    return NextResponse.json({ error: "reportId required" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > 28 * 1024 * 1024) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  const kindRaw = form.get("kind");
  const kind = kindRaw === "voice" ? "voice" : "photo";
  const contentType = file.type || "application/octet-stream";
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
        : contentType.includes("webm")
          ? "webm"
          : contentType.includes("ogg")
            ? "ogg"
            : contentType.includes("mp4") || contentType.includes("aac")
              ? "m4a"
              : kind === "voice"
                ? "webm"
                : "jpg");

  try {
    if (firestoreEmulatorHost()) {
      const relDir = path.join("reports", "guest");
      const fileName = `${reportId}-${kind}.${ext}`;
      const absDir = path.join(process.cwd(), "public", relDir);
      await mkdir(absDir, { recursive: true });
      await writeFile(path.join(absDir, fileName), bytes);
      const mediaUrl = `/${relDir}/${fileName}`;
      return NextResponse.json({
        ok: true,
        mediaPath: mediaUrl,
        mediaUrl,
        mediaMime: contentType,
      });
    }

    const uploaded = await uploadGuestMediaBytes({
      objectPath: `reports/web-guest/${reportId}/${kind}.${ext}`,
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
