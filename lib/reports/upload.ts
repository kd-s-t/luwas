const MAX_BYTES = 28 * 1024 * 1024;

/**
 * Upload report photo/voice via same-origin API (Admin GCS).
 * Avoids browser → Firebase Storage CORS on the custom media bucket.
 */
export async function uploadReportMedia(input: {
  citizenUid: string;
  reportId: string;
  file: File;
  kind?: "photo" | "voice";
}): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string }> {
  if (input.file.size > MAX_BYTES) {
    throw new Error("Media must be under 28 MB.");
  }

  const kind =
    input.kind ??
    (input.file.type.startsWith("audio/") || input.file.type.includes("webm")
      ? "voice"
      : "photo");

  const body = new FormData();
  body.set("reportId", input.reportId);
  body.set("citizenUid", input.citizenUid);
  body.set("kind", kind);
  body.set(
    "file",
    input.file,
    input.file.name || `${kind}.bin`,
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
    mediaMime: data.mediaMime || input.file.type || "application/octet-stream",
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
