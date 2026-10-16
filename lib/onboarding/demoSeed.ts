import { addHouseholds, seedHouseholds } from "@/lib/households/api";
import type { HouseholdInput } from "@/lib/households/types";
import {
  ensureApasOpsSeed,
  isApasAreaId,
} from "@/lib/onboarding/apasSeed";
import { ensureNangkaStaffSeed, upsertStaffMember } from "@/lib/staff/api";
import { NANGKA_STAFF_SEED } from "@/lib/staff/nangkaStaff";
import type { StaffMemberInput } from "@/lib/staff/types";

const FIRST = [
  "Ana",
  "Ben",
  "Carlo",
  "Diana",
  "Elena",
  "Felix",
  "Gina",
  "Hugo",
  "Ivy",
  "Jose",
];
const LAST = [
  "Santos",
  "Reyes",
  "Cruz",
  "Garcia",
  "Torres",
  "Lim",
  "Ong",
  "Dela Cruz",
];

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Small demo roster centered on the barangay hall pin. */
export function buildDemoHouseholds(
  center: { lat: number; lng: number },
  barangay: string,
  count = 24,
): HouseholdInput[] {
  const rand = mulberry32(
    Math.abs(
      Math.floor(center.lat * 1e5) ^ Math.floor(center.lng * 1e5) ^ count,
    ) || 1,
  );
  const out: HouseholdInput[] = [];
  for (let i = 0; i < count; i++) {
    const first = FIRST[Math.floor(rand() * FIRST.length)]!;
    const last = LAST[Math.floor(rand() * LAST.length)]!;
    const ownerName = `${first} ${last}`;
    const purok = `Purok ${(i % 6) + 1}`;
    const ang = rand() * Math.PI * 2;
    const dist = 0.0004 + rand() * 0.0035;
    out.push({
      ownerName,
      address: `${purok} · near Brgy. ${barangay} Hall · lot ${i + 1}`,
      purok,
      phone: `09${String(17 + (i % 6)).padStart(2, "0")}${String(3000000 + i).slice(0, 7)}`,
      email:
        rand() > 0.4
          ? `${first.toLowerCase()}.${last.toLowerCase().replace(/\s/g, "")}${i}@demo.ugnai.ph`
          : "",
      notes: `Demo seed · ${2 + (i % 5)} household members · Brgy. ${barangay}`,
      lat: center.lat + Math.cos(ang) * dist,
      lng: center.lng + Math.sin(ang) * dist,
    });
  }
  return out;
}

function demoStaffForBarangay(
  barangayId: string,
  orgName: string,
): StaffMemberInput[] {
  // Firestore doc ids cannot contain `/` (area ids like cebu-city/apas).
  const prefix = barangayId.replace(/\//g, "-");
  return NANGKA_STAFF_SEED.slice(0, 8).map((row) => ({
    ...row,
    id: `${prefix}__${row.id}`,
    reportsToId: row.reportsToId ? `${prefix}__${row.reportsToId}` : null,
    email: row.email.replace(
      "@nangka.consolacion.demo",
      `@${barangayId.replace(/\//g, ".")}.demo`,
    ),
    accountEmail: row.accountEmail
      ? row.accountEmail.replace(
          "@nangka.consolacion.demo",
          `@${barangayId.replace(/\//g, ".")}.demo`,
        )
      : undefined,
    notes: `${row.notes ?? ""} · demo seed for ${orgName}`.trim(),
  }));
}

/**
 * Seed a compact demo roster + staff pyramid for a newly activated barangay.
 * Uses Nangka staff template remapped to the new areaId.
 */
export async function seedDemoBarangayOps(input: {
  officerUid: string;
  areaId: string;
  barangay: string;
  orgName: string;
  center: { lat: number; lng: number };
}): Promise<{ households: number; staff: number }> {
  // Apas production starter: households + staff (sample reports only in sim).
  if (isApasAreaId(input.areaId)) {
    const { isSimulationOn } = await import("@/lib/config/simulation");
    const result = await ensureApasOpsSeed(input.officerUid, {
      includeSampleReports: isSimulationOn(),
    });
    return { households: result.households, staff: result.staff };
  }

  // Prefer remapped staff for non-Nangka; for Nangka use canonical seed.
  if (
    input.areaId === "nangka-consolacion" ||
    input.areaId === "consolacion/nangka" ||
    /nangka/i.test(input.areaId)
  ) {
    const households = buildDemoHouseholds(input.center, input.barangay, 24);
    const hhCount = await seedHouseholds(
      input.officerUid,
      input.orgName,
      households,
    );
    const { written } = await ensureNangkaStaffSeed();
    return { households: hhCount, staff: written };
  }

  // Other barangays: append households (do not wipe Nangka roster) + remap staff.
  const households = buildDemoHouseholds(input.center, input.barangay, 24);
  const hhCount = await addHouseholds(
    input.officerUid,
    input.orgName,
    households,
  );
  const staff = demoStaffForBarangay(input.areaId, input.orgName);
  const staffBarangayId = input.areaId.replace(/\//g, "-");
  for (const member of staff) {
    await upsertStaffMember(staffBarangayId, input.orgName, member);
  }
  return { households: hhCount, staff: staff.length };
}
