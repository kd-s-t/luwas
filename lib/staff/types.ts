/** Barangay / LGU staff directory — who works this brgy. */

export type StaffScope = "barangay" | "lgu";

/**
 * Hierarchy rank (lower = higher authority).
 * Used for org-chart depth and sort order.
 */
export type StaffRank =
  | "captain"
  | "lgu_director"
  | "secretary"
  | "treasurer"
  | "kagawad"
  | "sk_chair"
  | "mdrrmo"
  | "bhw"
  | "tanod_chief"
  | "tanod"
  | "volunteer"
  | "staff";

export type StaffMemberInput = {
  id: string;
  displayName: string;
  title: string;
  rank: StaffRank;
  scope: StaffScope;
  /** Parent staff id in the org chart (null = top of that branch). */
  reportsToId: string | null;
  office: string;
  phone: string;
  email: string;
  /** Optional login email if they have a LUWAS officer account. */
  accountEmail?: string;
  status: "active" | "leave" | "inactive";
  notes?: string;
};

export type StaffMember = StaffMemberInput & {
  barangayId: string;
  orgName: string;
  createdAt: string;
  updatedAt: string;
};

export const STAFF_RANK_ORDER: Record<StaffRank, number> = {
  captain: 0,
  lgu_director: 1,
  secretary: 2,
  treasurer: 2,
  kagawad: 3,
  sk_chair: 3,
  mdrrmo: 4,
  bhw: 5,
  tanod_chief: 5,
  tanod: 6,
  volunteer: 7,
  staff: 7,
};

export function staffRankLabel(rank: StaffRank): string {
  switch (rank) {
    case "captain":
      return "Punong Barangay";
    case "lgu_director":
      return "LGU / MDRRMO";
    case "secretary":
      return "Secretary";
    case "treasurer":
      return "Treasurer";
    case "kagawad":
      return "Kagawad";
    case "sk_chair":
      return "SK Chair";
    case "mdrrmo":
      return "BDRRMC / MDRRMO";
    case "bhw":
      return "Health worker";
    case "tanod_chief":
      return "Chief Tanod";
    case "tanod":
      return "Tanod";
    case "volunteer":
      return "Volunteer";
    default:
      return "Staff";
  }
}
