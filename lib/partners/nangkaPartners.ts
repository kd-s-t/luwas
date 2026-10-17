import type { ResourcePartnerInput } from "@/lib/partners/types";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/staff/nangkaStaff";
import seed from "../../scripts/nangka-partners-seed-data.json";

export { NANGKA_BARANGAY_ID, NANGKA_ORG_NAME };

/** Demo partner directory for Brgy. Nangka (no partner logins). */
export const NANGKA_PARTNER_SEED: (ResourcePartnerInput & { id: string })[] =
  seed as (ResourcePartnerInput & { id: string })[];
