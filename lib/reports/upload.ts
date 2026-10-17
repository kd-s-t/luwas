const MAX_BYTES = 28 * 1024 * 1024;
/** Longest edge for report / field photos (enough for Gemini + Vertex). */
const REPORT_PHOTO_MAX_EDGE = 1600;
const REPORT_PHOTO_JPEG_QUALITY = 0.82;

/**
 * Downscale + JPEG-encode report photos before upload (storage + AI payload).
 * Voices / videos / tiny images pass through unchanged.
 */
export async function compressReportImage(file: File): Promise<File> {
  const isImage =
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|bmp|heic|heif)$/i.test(file.name);
  if (!isImage || file.type === "image/gif") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;
    if (width < 1 || height < 1) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, REPORT_PHOTO_MAX_EDGE / Math.max(width, height));
    const outW = Math.max(1, Math.round(width * scale));
    const outH = Math.max(1, Math.round(height * scale));
    const alreadySmall =
      scale === 1 &&
      file.size <= 450 * 1024 &&
      (file.type === "image/jpeg" || file.type === "image/jpg");
    if (alreadySmall) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, outW, outH);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", REPORT_PHOTO_JPEG_QUALITY);
    });
    if (!blob || blob.size < 1) return file;
    // Keep original if compression somehow grew the file.
    if (blob.size >= file.size && scale === 1) return file;

    const base =
      (file.name || "photo").replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/**
 * Upload report photo/voice via same-origin API (Admin GCS).
 * Avoids browser → Firebase Storage CORS on the custom media bucket.
 */
export async function uploadReportMedia(input: {
  citizenUid: string;
  reportId: string;
  file: File;
  kind?: "photo" | "voice" | "field";
}): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string }> {
  if (input.file.size > MAX_BYTES) {
    throw new Error("Media must be under 28 MB.");
  }

  const kind =
    input.kind ??
    (input.file.type.startsWith("audio/") || input.file.type.includes("webm")
      ? "voice"
      : "photo");

  const file =
    kind === "voice" ? input.file : await compressReportImage(input.file);

  const body = new FormData();
  body.set("reportId", input.reportId);
  body.set("citizenUid", input.citizenUid);
  body.set("kind", kind);
  body.set(
    "file",
    file,
    file.name || `${kind}.bin`,
  );

  const res = await fetch("/api/reports/guest-upload", {
    method: "POST",
    body,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    mediaPath?: string;
    mediaUrl?: string;
    mediaMime?: string;
  };
  if (!res.ok || !data.mediaUrl || !data.mediaPath) {
    throw new Error(data.error || "Media upload failed");
  }

  return {
    mediaPath: data.mediaPath,
    mediaUrl: data.mediaUrl,
    mediaMime: data.mediaMime || file.type || "application/octet-stream",
  };
}

/** Read file as base64 (no data: prefix) for Gemini inline validation. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read media file"));
    reader.readAsDataURL(file);
  });
}
