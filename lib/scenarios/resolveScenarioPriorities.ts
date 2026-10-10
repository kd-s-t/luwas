import type { AssistHouseholdAction, AssistPriority } from "@/lib/ai/assistTypes";
import { CURATED_NANGKA_HOUSEHOLDS } from "@/lib/households/curatedSeed";
import type { Household } from "@/lib/households/types";

function seedIndexFromActionId(id: string): number | null {
  const m = id.match(/^(?:public-)?seed-(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function matchCuratedHousehold(
  curated: (typeof CURATED_NANGKA_HOUSEHOLDS)[number],
  households: Household[],
): Household | undefined {
  const email = curated.email?.trim().toLowerCase() ?? "";
  const phone = curated.phone?.trim() ?? "";
  if (email) {
    const byEmail = households.find(
      (h) => h.email.trim().toLowerCase() === email,
    );
    if (byEmail) return byEmail;
  }
  if (phone) {
    const byPhone = households.find((h) => h.phone.trim() === phone);
    if (byPhone) return byPhone;
  }
  const byName = households.find(
    (h) =>
      h.ownerName.trim() === curated.ownerName.trim() &&
      h.purok.trim() === curated.purok.trim(),
  );
  if (byName) return byName;

  const lat = curated.lat;
  const lng = curated.lng;
  if (lat == null || lng == null) return undefined;
  return households.find(
    (h) =>
      h.lat != null &&
      h.lng != null &&
      Math.abs(h.lat - lat) < 1e-5 &&
      Math.abs(h.lng - lng) < 1e-5,
  );
}

/**
 * Map CAT5 scenario actions onto the live roster.
 * Firestore docs use random ids — match curated pins 0–11 by email/phone/name.
 */
export function resolveScenarioPriorities(
  actions: AssistHouseholdAction[],
  households: Household[],
): Record<string, AssistPriority> {
  const map: Record<string, AssistPriority> = {};
  const byId = new Map(households.map((h) => [h.id, h]));

  for (const a of actions) {
    if (byId.has(a.householdId)) {
      map[a.householdId] = a.priority;
      continue;
    }

    const idx = seedIndexFromActionId(a.householdId);
    if (idx == null) continue;

    const seedId = `seed-${idx}`;
    if (byId.has(seedId)) {
      map[seedId] = a.priority;
      continue;
    }

    const curated = CURATED_NANGKA_HOUSEHOLDS[idx];
    if (!curated) continue;
    const hit = matchCuratedHousehold(curated, households);
    if (hit) map[hit.id] = a.priority;
  }

  return map;
}
