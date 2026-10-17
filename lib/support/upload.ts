import { compressReportImage } from "@/lib/reports/upload";

const MAX_BYTES = 28 * 1024 * 1024;
const MAX_MEDIA = 4;

function isVideoFile(file: File): boolean {
  return (
    file.type.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v|ogg|ogv)$/i.test(file.name)
  );
}

function isImageFile(file: File): boolean {
  return (
    file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name)
  );
}

/** Upload a support screenshot or video via same-origin API (Admin GCS). */
export async function uploadSupportMedia(input: {
  uid: string;
  file: File;
}): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string }> {
  if (input.file.size > MAX_BYTES) {
    throw new Error("File must be under 28 MB.");
  }
  if (!isImageFile(input.file) && !isVideoFile(input.file)) {
    throw new Error("Images or videos only.");
  }

  const file = isVideoFile(input.file)
    ? input.file
    : await compressReportImage(input.file);
  const body = new FormData();
  body.set("uid", input.uid.trim() || "guest");
  body.set(
    "file",
    file,
    file.name || (isVideoFile(file) ? "clip.mp4" : "screenshot.jpg"),
  );

  const res = await fetch("/api/support/upload", {
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

/** @deprecated use uploadSupportMedia */
export const uploadSupportImage = uploadSupportMedia;

export function supportMediaLimit(): number {
  return MAX_MEDIA;
}

/** @deprecated use supportMediaLimit */
export const supportImageLimit = supportMediaLimit;

export function isSupportVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg|ogv)(\?|$)/i.test(url);
}

export function isSupportMediaFile(file: File): boolean {
  return isImageFile(file) || isVideoFile(file);
}
