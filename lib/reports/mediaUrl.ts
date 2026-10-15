/** Rewrite Firebase token URLs for our custom GCS bucket into same-origin proxy URLs. */
export function resolveReportMediaUrl(url: string): string {
  const raw = String(url ?? "").trim();
  if (!raw) return raw;
  if (raw.startsWith("/api/media/")) return raw;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;

  try {
    const u = new URL(raw);
    if (u.hostname !== "firebasestorage.googleapis.com") return raw;
    const match = u.pathname.match(/\/v0\/b\/[^/]+\/o\/(.+)$/);
    if (!match) return raw;
    const objectPath = decodeURIComponent(match[1]);
    if (!objectPath.startsWith("reports/")) return raw;
    return `/api/media/${objectPath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/")}`;
  } catch {
    return raw;
  }
}

export function guestMediaProxyUrl(objectPath: string): string {
  return `/api/media/${objectPath
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/")}`;
}
