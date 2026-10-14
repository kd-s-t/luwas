/**
 * Tino Before/During/After packs + dummy officers/citizens.
 * Set NEXT_PUBLIC_SIMULATION_ON=true|false (must be NEXT_PUBLIC_ for client UI).
 * Default true when unset so local Cup demos keep working.
 */
export function isSimulationOn(): boolean {
  const raw = process.env.NEXT_PUBLIC_SIMULATION_ON?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return raw === "true" || raw === "1" || raw === "on" || raw === "yes";
}
