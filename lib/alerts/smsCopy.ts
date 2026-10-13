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
      `LUWAS ALERT · ${brgy}: ${name}${place}, please EVACUATE now to Consolacion Evacuation Center (or Center 2 / Nangka Elementary). ` +
      `Follow road escape routes. Tino simulation for responders. ` +
      `For emergencies call local PNP/BFP/barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `LUWAS ALERT · ${brgy}: ${name}${place}, PREPARE — stock water, food, cooking fuel; watch flood/wind. ` +
      `Tino simulation — call local responders if in danger.`
    );
  }
  return (
    `LUWAS ALERT · ${brgy}: ${name}${place}, MONITOR — check welfare and keep phone on. ` +
    `Tino simulation — call local responders if in danger.`
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
    `LUWAS ${input.alertLabel.toUpperCase()}: ${situation} @ ${place}${pin}. ` +
    `Please dispatch. Tino simulation.`
  );
}
