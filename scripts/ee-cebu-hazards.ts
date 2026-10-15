/**
 * Build Cebu-wide hazard cache from DEM + one FIRMS EE pull.
 * Also archives under data/ee-runs/ (same as admin UI).
 *
 * Usage: npm run ee:hazards
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runEarthEngineJob } from "../lib/geo/eeRunJobs";

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
  console.log("Building Cebu hazards (DEM-derived + FIRMS)…");
  const run = await runEarthEngineJob({
    job: "hazards",
    triggeredBy: "cli:ee:hazards",
  });
  if (run.status === "failed") {
    throw new Error(run.error || "Hazards run failed");
  }
  console.log(`Run ${run.id} ok`);
  for (const f of run.files) {
    console.log(`  ${f.name} (${f.bytes} bytes)`);
  }
  if (run.counts) {
    console.log(
      `Counts: ${Object.entries(run.counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(" · ")}`,
    );
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
