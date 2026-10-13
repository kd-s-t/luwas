import type { HazardReport, ReportHazardHint } from "@/lib/reports/types";

/** Vertex AutoML single-label classes for LUWAS hazard photos. */
export type VertexVisionClass =
  | "flood"
  | "accident"
  | "fire"
  | "landslide"
  | "unrelated";

export function hazardToVertexClass(hint: ReportHazardHint): VertexVisionClass {
  switch (hint) {
    case "flood":
      return "flood";
    case "fire":
      return "fire";
    case "landslide":
      return "landslide";
    case "accident":
    case "blockage":
    case "typhoon":
      return "accident";
    case "crime":
    case "evac":
    case "other":
    default:
      return "unrelated";
  }
}

function extFromUrlOrMime(url: string, mime: string): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("gif")) return "gif";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  const path = url.split("?")[0] ?? url;
  const dot = path.lastIndexOf(".");
  if (dot > 0) {
    const e = path.slice(dot + 1).toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif"].includes(e)) {
      return e === "jpeg" ? "jpg" : e;
    }
  }
  return "jpg";
}

/** Calendar month key `YYYY-MM` (local timezone). */
export function monthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function monthKeyFromIso(iso: string): string | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return monthKey(new Date(t));
}

function inMonth(iso: string, ym: string): boolean {
  return monthKeyFromIso(iso) === ym;
}

/** Human label for `YYYY-MM`, e.g. `Oct 2026`. */
export function formatMonthLabel(ym: string): string {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return ym;
  return new Date(y, m - 1, 1).toLocaleString(undefined, {
    month: "short",
    year: "numeric",
  });
}

export type VertexMonthOption = { ym: string; count: number };

/** Months that have exportable photo reports, newest first. */
export function listVertexBatchMonths(rows: HazardReport[]): VertexMonthOption[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    if (!r.mediaUrl || r.mediaType !== "photo") continue;
    if (r.status === "rejected") continue;
    const ym = monthKeyFromIso(r.createdAt);
    if (!ym) continue;
    counts.set(ym, (counts.get(ym) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([ym, count]) => ({ ym, count }))
    .sort((a, b) => b.ym.localeCompare(a.ym));
}

export function reportsForVertexMonthBatch(
  rows: HazardReport[],
  ym: string,
): HazardReport[] {
  return rows.filter((r) => {
    if (!r.mediaUrl || r.mediaType !== "photo") return false;
    if (r.status === "rejected") return false;
    return inMonth(r.createdAt, ym);
  });
}

/**
 * Build a Vertex-ready zip:
 *   images/{class}/{id}.jpg
 *   labels.csv          → relative path,label (after you upload images/ to GCS, rewrite to gs://)
 *   labels-gcs.csv      → gs://YOUR_BUCKET/luwas-vision/{YYYY-MM}/…
 *   README.txt
 */
export async function downloadVertexMonthZip(
  rows: HazardReport[],
  opts?: { bucket?: string; monthYm?: string },
): Promise<{ count: number; fileName: string }> {
  const ym = opts?.monthYm ?? monthKey();
  const batch = reportsForVertexMonthBatch(rows, ym);
  if (batch.length === 0) {
    throw new Error(`No photo reports in ${formatMonthLabel(ym)} to export.`);
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const bucket = (opts?.bucket || "YOUR_BUCKET").trim() || "YOUR_BUCKET";
  const prefix = `luwas-vision/${ym}`;

  const relLines: string[] = [];
  const gcsLines: string[] = [];
  let packed = 0;

  for (const r of batch) {
    const cls = hazardToVertexClass(r.hazardHint);
    const ext = extFromUrlOrMime(r.mediaUrl, r.mediaMime);
    const safeId = r.id.replace(/[^a-zA-Z0-9_-]/g, "_");
    const relPath = `images/${cls}/${safeId}.${ext}`;
    const gcsPath = `gs://${bucket}/${prefix}/${cls}/${safeId}.${ext}`;

    try {
      const res = await fetch(r.mediaUrl);
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      zip.file(relPath, buf);
      relLines.push(`${relPath},${cls}`);
      gcsLines.push(`${gcsPath},${cls}`);
      packed += 1;
    } catch {
      /* skip broken media */
    }
  }

  if (packed === 0) {
    throw new Error(
      `Could not download any report images for ${formatMonthLabel(ym)}.`,
    );
  }

  zip.file("labels.csv", relLines.join("\n") + "\n");
  zip.file("labels-gcs.csv", gcsLines.join("\n") + "\n");
  zip.file(
    "README.txt",
    [
      `LUWAS → Vertex AI vision batch (${ym})`,
      `Images packed: ${packed}`,
      ``,
      `Vertex import (recommended):`,
      `1. Unzip this file.`,
      `2. Upload the images/ folder to Cloud Storage:`,
      `   gsutil -m cp -r images gs://${bucket}/${prefix}/`,
      `3. Open dataset luwas-vision-v1 → Import.`,
      `4. Use labels-gcs.csv (edit YOUR_BUCKET if needed).`,
      `   Format: gs://path/to/image.jpg,label`,
      ``,
      `labels.csv uses relative paths for inspection only.`,
      `Classes: flood | accident | fire | landslide | unrelated`,
      `Skipped: rejected reports, videos, other months.`,
      ``,
    ].join("\n"),
  );

  const blob = await zip.generateAsync({ type: "blob" });
  const fileName = `luwas-vision-${ym}.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { count: packed, fileName };
}
