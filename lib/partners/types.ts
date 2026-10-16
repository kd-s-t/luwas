/** External supply partners for the Resources / Find assistance desk. */

export type PartnerType = "ngo" | "dswd" | "lgu" | "private" | "other";

export type PartnerSupply =
  | "medical"
  | "food"
  | "water"
  | "transport"
  | "shelter"
  | "other";

export type ResourcePartnerInput = {
  name: string;
  type: PartnerType;
  contactName: string;
  phone: string;
  supplies: PartnerSupply[];
  coverage: string;
  notes?: string;
  status?: "active" | "inactive";
};

export type ResourcePartner = ResourcePartnerInput & {
  id: string;
  barangayId: string;
  orgName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export function partnerTypeLabel(type: PartnerType): string {
  switch (type) {
    case "ngo":
      return "NGO";
    case "dswd":
      return "DSWD";
    case "lgu":
      return "LGU";
    case "private":
      return "Private";
    default:
      return "Other";
  }
}

export function partnerSupplyLabel(supply: PartnerSupply): string {
  switch (supply) {
    case "medical":
      return "Medical kits";
    case "food":
      return "Food packs";
    case "water":
      return "Water";
    case "transport":
      return "Transport";
    case "shelter":
      return "Shelter";
    default:
      return "Other";
  }
}
