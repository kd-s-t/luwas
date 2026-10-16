import type { ResourcePartnerInput } from "@/lib/partners/types";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/staff/nangkaStaff";

export { NANGKA_BARANGAY_ID, NANGKA_ORG_NAME };

/** Demo partner directory for Brgy. Nangka (no partner logins). */
export const NANGKA_PARTNER_SEED: (ResourcePartnerInput & { id: string })[] = [
  {
    id: "red-cross-cebu",
    name: "Red Cross Cebu",
    type: "ngo",
    contactName: "C. Lim",
    phone: "09171234501",
    supplies: ["medical", "shelter", "transport"],
    coverage: "Consolacion · Metro Cebu",
    notes: "Medical kits and partner transport. Confirm before allocation.",
    status: "active",
  },
  {
    id: "dswd-region-7",
    name: "DSWD Regional Office",
    type: "dswd",
    contactName: "Relief desk",
    phone: "09171234502",
    supplies: ["food", "water"],
    coverage: "Region VII",
    notes: "Food and water desk. Often unconfirmed until called.",
    status: "active",
  },
];
