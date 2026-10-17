import type { AssistPriority } from "@/lib/ai/assistTypes";

export function buildEvacSmsBody(input: {
  ownerName: string;
  purok?: string;
  priority: AssistPriority;
  barangay?: string;
}): string {
  const brgy = input.barangay ?? "Brgy. Nangka";
  const place = input.purok ? ` (${input.purok})` : "";
  const name = input.ownerName.trim() || "Resident";

  if (input.priority === "evacuate") {
    return (
      `UGNAI ALERT · ${brgy}: ${name}${place}, please EVACUATE now to Consolacion Evacuation Center (or Center 2 / Nangka Elementary). ` +
      `Follow road escape routes. Tino simulation for responders. ` +
      `For emergencies call local PNP/BFP/barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `UGNAI ALERT · ${brgy}: ${name}${place}, PREPARE — stock water, food, cooking fuel; watch flood/wind. ` +
      `Tino simulation — call local responders if in danger.`
    );
  }
  return (
    `UGNAI ALERT · ${brgy}: ${name}${place}, MONITOR — check welfare and keep phone on. ` +
    `Tino simulation — call local responders if in danger.`
  );
}

/** SMS when an investigator is assigned to a report. */
export function buildInvestigatorAssignSmsBody(input: {
  ownerName: string;
  barangay?: string;
  title?: string | null;
  hazardHint?: string | null;
  reportId?: string | null;
}): string {
  const brgy = input.barangay ?? "barangay";
  const name = input.ownerName.trim() || "Officer";
  const hazard = (input.hazardHint ?? "hazard").replace(/_/g, " ");
  const title = (input.title ?? "citizen report").trim().slice(0, 50);
  const ref = input.reportId?.trim() ? ` Ref ${input.reportId.trim()}.` : "";
  return (
    `UGNAI · ${brgy}: ${name}, you are ASSIGNED investigator for ${hazard}: ${title}.${ref} ` +
    `Open Incidents in UGNAI. Tino simulation.`
  );
}

/** SMS to the citizen after ops marks the report dispatched. */
export function buildReporterDispatchSmsBody(input: {
  ownerName: string;
  barangay?: string;
  title?: string | null;
  hazardHint?: string | null;
  reportId?: string | null;
}): string {
  const brgy = input.barangay ?? "barangay";
  const name = input.ownerName.trim() || "Reporter";
  const hazard = (input.hazardHint ?? "hazard").replace(/_/g, " ");
  const title = (input.title ?? "your report").trim().slice(0, 50);
  const ref = input.reportId?.trim() ? ` Ref ${input.reportId.trim()}.` : "";
  return (
    `UGNAI · ${brgy}: ${name}, responders are DISPATCHED for your ${hazard} report: ${title}.${ref} ` +
    `Track status at ugnaiph.com/track-report. Stay safe.`
  );
}

/** Brief SMS for auto fire / crime / accident dispatch to responders. */
export function buildIncidentAlertSmsBody(input: {
  alertLabel: string;
  barangay?: string;
  purok?: string | null;
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
}): string {
  const brgy = input.barangay ?? "Nangka";
  const place = input.purok?.trim()
    ? `${input.purok.trim().slice(0, 24)}, ${brgy}`
    : brgy;
  const situation = input.title?.trim()
    ? input.title.trim().slice(0, 40)
    : `${input.alertLabel} reported`;
  const pin =
    typeof input.lat === "number" && typeof input.lng === "number"
      ? ` ${input.lat.toFixed(3)},${input.lng.toFixed(3)}`
      : "";

  return (
    `UGNAI ${input.alertLabel.toUpperCase()}: ${situation} @ ${place}${pin}. ` +
    `Please dispatch. Tino simulation.`
  );
}
