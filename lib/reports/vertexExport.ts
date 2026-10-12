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
    case "typhoon":
      return "accident";
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

function monthKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function inThisMonth(iso: string, now = new Date()): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  const d = new Date(t);
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  );
}

export function reportsForVertexMonthBatch(
  rows: HazardReport[],
  now = new Date(),
): HazardReport[] {
  return rows.filter((r) => {
    if (!r.mediaUrl || r.mediaType !== "photo") return false;
    if (r.status === "rejected") return false;
    return inThisMonth(r.createdAt, now);
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
  opts?: { bucket?: string; now?: Date },
): Promise<{ count: number; fileName: string }> {
  const now = opts?.now ?? new Date();
  const batch = reportsForVertexMonthBatch(rows, now);
  if (batch.length === 0) {
    throw new Error("No photo reports this month to export.");
  }

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const ym = monthKey(now);
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
    throw new Error("Could not download any report images for this month.");
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
