/**
 * Build Cebu-wide hazard cache:
 * - floods + landslides from data/cebu-ee-dem.json (no EE call)
 * - fires from one FIRMS Earth Engine evaluate
 *
 * Usage: npm run ee:hazards
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sampleCebuFires } from "../lib/geo/earthEngine";
import { hazardsFromCebuDem } from "../lib/geo/cebuEeHazards";
import type { ElevSample } from "../lib/geo/nangkaElevationGrid";
import type { FireSample } from "../lib/hazards/fireSamples";
import { distKm } from "../lib/geo/bearing";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

loadEnvFile(join(root, ".env.local"));
loadEnvFile(join(root, ".env"));

function thinFires(fires: FireSample[], minKm: number): FireSample[] {
  const kept: FireSample[] = [];
  for (const f of fires) {
    if (kept.some((k) => distKm(k, f) < minKm)) continue;
    kept.push(f);
  }
  return kept;
}

async function main() {
  const demPath = join(root, "data", "cebu-ee-dem.json");
  if (!existsSync(demPath)) {
    throw new Error("Missing data/cebu-ee-dem.json — run npm run ee:dem first.");
  }
  const dem = JSON.parse(readFileSync(demPath, "utf8")) as {
    samples?: ElevSample[];
    projectId?: string;
    provider?: string;
  };
  if (!dem.samples?.length) {
    throw new Error("cebu-ee-dem.json has no samples — run npm run ee:dem first.");
  }

  console.log(`Deriving floods/landslides from ${dem.samples.length} DEM points…`);
  const { floods, landslides } = hazardsFromCebuDem(dem.samples);

  console.log("Sampling FIRMS fires via Earth Engine…");
  const { projectId, hotspots, window } = await sampleCebuFires(90);
  console.log(`FIRMS window: ${window} (${hotspots.length} raw hotspots)`);
  const firesRaw: FireSample[] = hotspots
    .sort((a, b) => b.t21 - a.t21)
    .map((h, i) => {
      const severity: FireSample["severity"] =
        h.t21 >= 360 ? "critical" : h.t21 >= 340 ? "warning" : "watch";
      return {
        id: `ee-fire-cebu-${i}`,
        name: `FIRMS hotspot · T21 ${h.t21.toFixed(0)}`,
        place: `MODIS FIRMS (Earth Engine, ${window})`,
        purokHint: "Cebu",
        severity,
        lat: h.lat,
        lng: h.lng,
        reportedAt: new Date().toISOString(),
        notes: `Brightness T21=${h.t21.toFixed(1)}${
          h.confidence != null ? ` · confidence ${h.confidence}` : ""
        }.`,
      };
    });
  const fires = thinFires(firesRaw, 2).slice(0, 100);

  const out = {
    provider: `DEM:${dem.provider ?? "USGS/SRTMGL1_003"}+FIRMS`,
    fetchedAt: new Date().toISOString(),
    projectId: projectId || dem.projectId || null,
    floods,
    landslides,
    fires,
  };
  const outPath = join(root, "data", "cebu-ee-hazards.json");
  writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.log(
    `Wrote floods=${floods.length} landslides=${landslides.length} fires=${fires.length} → ${outPath}`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
