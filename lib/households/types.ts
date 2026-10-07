export type Household = {
  id: string;
  ownerName: string;
  address: string;
  purok: string;
  phone: string;
  email: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  officerUid: string;
  orgName: string;
  createdAt: string;
  /** ISO timestamp — same as createdAt until a household is edited. */
  updatedAt: string;
};

export type HouseholdInput = {
  ownerName: string;
  address: string;
  purok: string;
  phone: string;
  email: string;
  notes: string;
  lat?: number;
  lng?: number;
};
