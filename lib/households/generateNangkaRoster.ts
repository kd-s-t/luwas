import { CURATED_NANGKA_HOUSEHOLDS } from "@/lib/households/curatedSeed";
import { isOnNangkaWater } from "@/lib/households/nangkaWater";
import type { HouseholdInput } from "@/lib/households/types";

/** PSA 2020 Census of Population and Housing — Brgy. Nangka, Consolacion. */
export const NANGKA_CENSUS_2020 = 13_013;

/**
 * House-owner households for the ops roster (one row per home, not per adult).
 * ~1,500 homes ≈ couples / families under one owner — not the full 2.9k PSA HH count.
 */
export const NANGKA_HOUSEHOLD_TARGET = 1_500;

/** Mean people per house-owner row (demo sizing; not a full census rebuild). */
const PEOPLE_PER_HOUSE_OWNER = 4.5;

const FIRST_NAMES = [
  "Jose",
  "Maria",
  "Juan",
  "Ana",
  "Pedro",
  "Rosa",
  "Carlos",
  "Elena",
  "Miguel",
  "Sofia",
  "Antonio",
  "Grace",
  "Ramon",
  "Liza",
  "Mark",
  "Joy",
  "Paolo",
  "Nina",
  "Rico",
  "Cathy",
  "Ben",
  "Tess",
  "Allan",
  "Mae",
  "Eric",
  "Joan",
  "Leo",
  "Iris",
  "Noel",
  "Diana",
] as const;

const LAST_NAMES = [
  "Reyes",
  "Cruz",
  "Santos",
  "Garcia",
  "Mendoza",
  "Bautista",
  "Villanueva",
  "Aquino",
  "Navarro",
  "Ramos",
  "Lim",
  "Tan",
  "Go",
  "Dela Cruz",
  "Fernandez",
  "Torres",
  "Flores",
  "Castillo",
  "Rivera",
  "Gonzales",
  "Lopez",
  "Perez",
  "Diaz",
  "Morales",
  "Santiago",
  "Castro",
  "Ortega",
  "Vargas",
  "Jimenez",
  "Romero",
] as const;

const NOTE_TAGS = [
  "Single-storey concrete",
  "2-storey · upper floor OK",
  "Flood-watch lot",
  "Near drainage canal",
  "Rents ground floor",
  "Elderly in household",
  "PWD member",
  "Infant in household",
  "Vendor / sari-sari",
  "Teacher household",
  "OFW remittance house",
  "New construction",
] as const;

/**
 * Purok anchors near the Access Road — houses are placed OFF the road
 * (residential strips north/south), not on the carriageway.
 */
const PUROK_ANCHORS: {
  purok: string;
  lat: number;
  lng: number;
  /** Prefer north (+1) or south (-1) of the road corridor. */
  sideBias: 1 | -1;
}[] = [
  { purok: "Purok 1", lat: 10.3709, lng: 123.9592, sideBias: 1 },
  { purok: "Purok 2", lat: 10.3703, lng: 123.9607, sideBias: -1 },
  { purok: "Purok 3", lat: 10.3721, lng: 123.9593, sideBias: 1 },
  { purok: "Purok 4", lat: 10.3698, lng: 123.9624, sideBias: -1 },
  { purok: "Purok 5", lat: 10.3701, lng: 123.9637, sideBias: 1 },
  { purok: "Purok 6", lat: 10.3685, lng: 123.9658, sideBias: -1 },
];

/** ~40–120 m off the road centerline — never on Cansaga / Jagobiao water. */
function placeOffRoad(
  anchor: (typeof PUROK_ANCHORS)[number],
  rand: () => number,
): { lat: number; lng: number } {
  for (let attempt = 0; attempt < 48; attempt++) {
    const side = rand() < 0.78 ? anchor.sideBias : (-anchor.sideBias as 1 | -1);
    const offRoadM = 40 + rand() * 80;
    const offLat = (offRoadM / 111_320) * side;
    // Keep along-corridor spread tighter so fewer draws hit river banks.
    const alongLng = (rand() - 0.5) * 0.002;
    const alongLat = (rand() - 0.5) * 0.0003;
    const lat = anchor.lat + offLat + alongLat;
    const lng = anchor.lng + alongLng;
    if (!isOnNangkaWater(lat, lng)) return { lat, lng };
  }
  // Last resort: sit just off the purok anchor on the dry side of the road.
  const fallbackLat = anchor.lat + (55 / 111_320) * anchor.sideBias;
  const fallbackLng = anchor.lng + (rand() - 0.5) * 0.0004;
  if (!isOnNangkaWater(fallbackLat, fallbackLng)) {
    return { lat: fallbackLat, lng: fallbackLng };
  }
  return { lat: anchor.lat, lng: anchor.lng };
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function slugEmail(name: string, index: number): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 28);
  return `${base}.${index}@nangka.consolacion.demo`;
}

function sampleMembers(rand: () => number): number {
  // Skew around 4–5 so mean ≈ PEOPLE_PER_HOUSE_OWNER.
  const roll = rand();
  if (roll < 0.06) return 1;
  if (roll < 0.14) return 2;
  if (roll < 0.26) return 3;
  if (roll < 0.48) return 4;
  if (roll < 0.72) return 5;
  if (roll < 0.88) return 6;
  if (roll < 0.96) return 7;
  return 8;
}

function parseCuratedMembers(notes: string): number {
  const m = notes.match(/(\d+)\s+household members/i);
  if (m) return Number(m[1]);
  if (/(\d+)\s+children/i.test(notes)) {
    const kids = Number(notes.match(/(\d+)\s+children/i)?.[1] ?? 3);
    return kids + 2;
  }
  return 4;
}

/** Nudge member counts so the synthetic roster sums to the census total. */
function fitMembersToCensus(counts: number[], targetPeople: number): number[] {
  const next = counts.map((n) => Math.max(1, n));
  let sum = next.reduce((a, b) => a + b, 0);
  let i = 0;
  while (sum < targetPeople && i < targetPeople * 2) {
    const idx = i % next.length;
    if (next[idx]! < 10) {
      next[idx]! += 1;
      sum += 1;
    }
    i += 1;
  }
  i = 0;
  while (sum > targetPeople && i < targetPeople * 2) {
    const idx = i % next.length;
    if (next[idx]! > 1) {
      next[idx]! -= 1;
      sum -= 1;
    }
    i += 1;
  }
  return next;
}

/**
 * Census-aligned synthetic Nangka roster.
 * Indices 0–11 are the curated pins used by CAT5 scenarios.
 */
export function generateNangkaRoster(
  target = NANGKA_HOUSEHOLD_TARGET,
): HouseholdInput[] {
  const curated = CURATED_NANGKA_HOUSEHOLDS;
  if (target <= curated.length) {
    return curated.slice(0, target);
  }

  const rand = mulberry32(0x4e616e67); // "Nang"
  const curatedMembers = curated.map((h) => parseCuratedMembers(h.notes));
  const remaining = target - curated.length;
  const curatedPeople = curatedMembers.reduce((a, b) => a + b, 0);
  const peopleBudget = Math.max(
    remaining,
    Math.round(target * PEOPLE_PER_HOUSE_OWNER) - curatedPeople,
  );
  const synthMembers = fitMembersToCensus(
    Array.from({ length: remaining }, () => sampleMembers(rand)),
    peopleBudget,
  );

  const out: HouseholdInput[] = curated.map((h, idx) => ({
    ...h,
    notes: h.notes.includes("household members")
      ? h.notes
      : `${h.notes} · ${curatedMembers[idx]} household members`,
  }));

  for (let i = 0; i < remaining; i++) {
    const globalIndex = curated.length + i;
    const anchor = PUROK_ANCHORS[globalIndex % PUROK_ANCHORS.length]!;
    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]!;
    const last = LAST_NAMES[Math.floor(rand() * LAST_NAMES.length)]!;
    const ownerName = `${first} ${last}`;
    const members = synthMembers[i] ?? 4;
    const { lat, lng } = placeOffRoad(anchor, rand);
    const tag = NOTE_TAGS[Math.floor(rand() * NOTE_TAGS.length)]!;
    const phone = `09${String(17 + (globalIndex % 6)).padStart(2, "0")}${String(
      2000000 + globalIndex,
    ).slice(0, 7)}`;

    out.push({
      ownerName,
      address: `${anchor.purok} residential lane · lot ${globalIndex + 1}`,
      purok: anchor.purok,
      phone,
      email: rand() > 0.35 ? slugEmail(ownerName, globalIndex) : "",
      notes: `${tag} · ${members} household members · PSA-scale roster`,
      lat,
      lng,
    });
  }

  return out;
}

/** Full Nangka roster — memoized once per module load. */
export const CEBU_HOUSEHOLDS: HouseholdInput[] = generateNangkaRoster(
  NANGKA_HOUSEHOLD_TARGET,
);
