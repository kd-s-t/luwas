import { isSimulationOn } from "@/lib/config/simulation";
import type { HazardReport } from "@/lib/reports/types";

/**
 * Tino Before/During/After map pins + queue sample seeds.
 * These clutter the live Incidents board on prod.
 */
export function isTinoScenarioDemoReport(
  r: Pick<HazardReport, "id" | "citizenUid" | "aiModel">,
): boolean {
  if (r.citizenUid === "demo-map-seed") return true;
  if (r.id.startsWith("rpt-")) return true;
  if (r.aiModel === "sample-seed") return true;
  // Queue samples: …-YYMMDD-9xxx (9001–9999)
  if (/^[A-Z]{2,4}-[A-Z0-9]{2,8}-[A-Z0-9]{2,10}-\d{6}-9\d{3}$/.test(r.id)) {
    return true;
  }
  return false;
}

/** Hide scenario demo tickets on luwasph / when simulation is off. */
export function hideScenarioDemoReportsInUi(): boolean {
  const app = process.env.NEXT_PUBLIC_APP_URL?.toLowerCase() ?? "";
  if (app.includes("luwasph.com")) return true;
  return !isSimulationOn();
}
