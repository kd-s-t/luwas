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
      `Follow road escape routes. Odette simulation for responders. ` +
      `For emergencies call local PNP/BFP/barangay.`
    );
  }
  if (input.priority === "prepare") {
    return (
      `LUWAS ALERT · ${brgy}: ${name}${place}, PREPARE — stock water, food, cooking fuel; watch flood/wind. ` +
      `Odette simulation — call local responders if in danger.`
    );
  }
  return (
    `LUWAS ALERT · ${brgy}: ${name}${place}, MONITOR — check welfare and keep phone on. ` +
    `Odette simulation — call local responders if in danger.`
  );
}
