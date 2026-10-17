import { NextResponse } from "next/server";
import {
  firestoreEmulatorHost,
  uploadGuestMediaBytes,
} from "@/lib/reports/serverGuestWrite";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const UID = /^[A-Za-z0-9_-]{3,128}$/;
const MAX_BYTES = 28 * 1024 * 1024;

/**
 * Support media upload (images + videos).
 * Stored under support/{uid|guest}/… and served via /api/media/…
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const uidRaw = form.get("uid");
  const uid =
    typeof uidRaw === "string" && UID.test(uidRaw.trim())
      ? uidRaw.trim()
      : "guest";

  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 400 });
  }

  const contentType = file.type || "application/octet-stream";
  const isImage = contentType.startsWith("image/");
  const isVideo = contentType.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "Images or videos only" },
      { status: 400 },
    );
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
            : contentType.includes("quicktime")
              ? "mov"
              : isVideo
                ? "mp4"
                : "jpg");

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const objectPath = `support/${uid}/${stamp}.${ext}`;

  try {
    if (firestoreEmulatorHost()) {
      const relDir = path.join("support", uid);
      const absDir = path.join(process.cwd(), "public", relDir);
      await mkdir(absDir, { recursive: true });
      const fileName = `${stamp}.${ext}`;
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
    console.error("[support-upload] failed", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Support media upload failed",
      },
      { status: 502 },
    );
  }
}
