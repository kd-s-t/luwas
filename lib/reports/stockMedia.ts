/**
 * Bundled demo / seed images under public/reports/.
 * Never treat these as a citizen's uploaded evidence.
 */
const STOCK_REPORT_MEDIA =
  /^\/reports\/(?!guest\/)[^/]+\.(png|jpe?g|webp|gif)$/i;

export function isStockReportMediaUrl(
  url: string | null | undefined,
): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return true;
  if (raw.startsWith("draft://")) return true;
  try {
    const path = raw.startsWith("http")
      ? new URL(raw).pathname
      : raw.split("?")[0] ?? raw;
    return STOCK_REPORT_MEDIA.test(path);
  } catch {
    return STOCK_REPORT_MEDIA.test(raw.split("?")[0] ?? raw);
  }
}
