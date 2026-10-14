/**
 * One Earth Engine call: whole-Cebu coarse DEM + fine Nangka grid.
 * Writes:
 *   data/cebu-ee-dem.json   — full pull
 *   data/nangka-ee-dem.json — Nangka bbox slice (flood tiles)
 *
 * Usage (from luwas/):
 *   npm run ee:dem
 *
 * Loads KEY=value from .env.local / .env when present.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterNangkaSamples,
  sampleCebuDem,
} from "../lib/geo/earthEngine";

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

async function main() {
  console.log(
    "Sampling Cebu DEM via Earth Engine (one evaluate: island coarse + Nangka fine)…",
  );
  const result = await sampleCebuDem();
  const cebuPath = join(root, "data", "cebu-ee-dem.json");
  writeFileSync(cebuPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const nangkaSamples = filterNangkaSamples(result.samples);
  if (!nangkaSamples.length) {
    throw new Error(
      "Cebu pull succeeded but no samples fell inside the Nangka bbox.",
    );
  }
  const nangka = {
    provider: result.provider,
    fetchedAt: result.fetchedAt,
    projectId: result.projectId,
    scope: "nangka" as const,
    samples: nangkaSamples,
  };
  const nangkaPath = join(root, "data", "nangka-ee-dem.json");
  writeFileSync(nangkaPath, `${JSON.stringify(nangka, null, 2)}\n`, "utf8");

  console.log(
    `Wrote ${result.samples.length} Cebu samples → ${cebuPath}`,
  );
  console.log(
    `Wrote ${nangkaSamples.length} Nangka samples → ${nangkaPath} (${result.provider})`,
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
