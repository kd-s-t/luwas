/** Accepted PH IDs for Luwas registration (fraud check). */
export const ACCEPTED_ID_TYPES = [
  {
    id: "dl",
    label: "Driver’s License",
    hint: "LTO card · front",
  },
  {
    id: "passport",
    label: "Passport",
    hint: "Data page with photo",
  },
  {
    id: "umid",
    label: "UMID",
    hint: "SSS / GSIS UMID card · front",
  },
] as const;

export type AcceptedIdType = (typeof ACCEPTED_ID_TYPES)[number]["id"];

export type IdVerificationResult = {
  verified: boolean;
  idType: AcceptedIdType | null;
  confidence: number;
  extractedName: string | null;
  reason: string;
  source: "gemini" | "local";
  model?: string;
};

export type IdVerificationMeta = {
  idVerified: boolean;
  idType: AcceptedIdType | null;
  idConfidence: number | null;
  idReason: string | null;
  idVerifiedAt: string | null;
  idSource: "gemini" | "local" | null;
};
