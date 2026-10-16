import type { UserProfile } from "@/lib/auth/types";
import { NANGKA_BARANGAY_ID } from "@/lib/evacCenters/nangkaSeed";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";

export type EvacBarangayScope = {
  barangayId: string;
  label: string;
  lgu: string;
};

/** Map signed-in place / area fields to the evacCenters barangayId. */
export function resolveEvacBarangayFromProfile(
  profile: UserProfile | null | undefined,
): EvacBarangayScope {
  const area = (
    (profile && "activeBarangayId" in profile
      ? profile.activeBarangayId
      : null) ??
    profile?.areaId ??
    ""
  )
    .trim()
    .toLowerCase();
  const barangay = (profile?.barangay ?? "").trim().toLowerCase();
  const lgu = (profile?.lgu ?? "").trim();

  if (area.includes("apas") || barangay === "apas") {
    return {
      barangayId: APAS_BARANGAY_DOC_ID,
      label: "Apas",
      lgu: lgu || "Cebu City",
    };
  }

  return {
    barangayId: NANGKA_BARANGAY_ID,
    label:
      barangay === "nangka" || !barangay
        ? "Nangka"
        : (profile?.barangay?.trim() ?? "Nangka"),
    lgu: lgu || "Consolacion",
  };
}
