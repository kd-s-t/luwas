import { APAS_ORG_NAME } from "@/lib/households/apasCuratedSeed";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/staff/nangkaStaff";

/** Ops barangays that get Inventory seeds and desk scope. */
export type ActiveInventoryBarangay = {
  barangayId: string;
  areaId: string;
  orgName: string;
  barangay: string;
  lgu: string;
};

export const ACTIVE_INVENTORY_BARANGAYS: ActiveInventoryBarangay[] = [
  {
    barangayId: NANGKA_BARANGAY_ID,
    areaId: "consolacion/nangka",
    orgName: NANGKA_ORG_NAME,
    barangay: "Nangka",
    lgu: "Consolacion",
  },
  {
    barangayId: APAS_BARANGAY_DOC_ID,
    areaId: "cebu-city/apas",
    orgName: APAS_ORG_NAME,
    barangay: "Apas",
    lgu: "Cebu City",
  },
];

export function activeInventoryBarangay(
  barangayId: string,
): ActiveInventoryBarangay | undefined {
  return ACTIVE_INVENTORY_BARANGAYS.find((b) => b.barangayId === barangayId);
}
