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
  /** Contact named after meeting and agreement. */
  contactName: string;
  phone: string;
  email: string;
  /** Public brand asset path, e.g. /brands/dswd.png */
  logoUrl?: string;
  /** Depot / desk pin for distance from barangay hall. */
  lat?: number;
  lng?: number;
  supplies: PartnerSupply[];
  coverage: string;
  notes?: string;
  status?: "active" | "inactive";
};

/** Resolve logo for directory / Find assistance cards. */
export function partnerLogoUrl(
  partner: Pick<ResourcePartnerInput, "name" | "type" | "logoUrl"> & {
    id?: string;
  },
): string | null {
  const explicit = partner.logoUrl?.trim();
  if (explicit) return explicit;
  if (
    partner.id === "red-cross-cebu" ||
    /red\s*cross/i.test(partner.name)
  ) {
    return "/brands/philippine-red-cross.png";
  }
  if (partner.type === "dswd" || partner.id === "dswd-region-7") {
    return "/brands/dswd.png";
  }
  if (partner.id === "ocd-region-7" || /\bocd\b/i.test(partner.name)) {
    return "/brands/ocd.png";
  }
  if (
    partner.id === "consolacion-mdrrmo" ||
    /consolacion.*ldrrmo|ldrrmo.*consolacion/i.test(partner.name)
  ) {
    return "/brands/consolacion-ldrrmo.jpg";
  }
  if (
    partner.id === "abs-cbn-lingkod" ||
    /lingkod\s*kapamilya|abs-?cbn/i.test(partner.name)
  ) {
    return "/brands/abs-cbn-lingkod.jpg";
  }
  if (
    partner.id === "world-vision-7" ||
    /world\s*vision/i.test(partner.name)
  ) {
    return "/brands/world-vision.png";
  }
  if (partner.id === "caritas-cebu" || /caritas/i.test(partner.name)) {
    return "/brands/caritas.png";
  }
  if (
    partner.id === "volunteer-transport-coop" ||
    /\botc\b|transport\s*co-?op/i.test(partner.name)
  ) {
    return "/brands/otc.png";
  }
  return null;
}

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
