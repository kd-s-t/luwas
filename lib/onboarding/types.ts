export const ONBOARD_STEPS = [
  "orientation",
  "pick",
  "hall",
  "org",
  "checklist",
  "done",
] as const;

export type OnboardStep = (typeof ONBOARD_STEPS)[number];

export type OnboardChecklist = {
  householdsReady: boolean;
  staffReady: boolean;
  templatesReviewed: boolean;
  mapOpened: boolean;
};

export type OnboardedBarangay = {
  id: string;
  barangay: string;
  lgu: string;
  name: string;
  orgName: string;
  hallAddress: string;
  hotline: string;
  email: string;
  center: { lat: number; lng: number };
  zoom: number;
  checklist: OnboardChecklist;
  activatedAt: string;
  updatedAt: string;
  /** Officer uid who activated this barangay. */
  activatedBy?: string;
};

export type OnboardDraft = {
  step: OnboardStep;
  areaId: string | null;
  barangay: string;
  lgu: string;
  name: string;
  orgName: string;
  hallAddress: string;
  hotline: string;
  email: string;
  center: { lat: number; lng: number } | null;
  zoom: number;
  checklist: OnboardChecklist;
  resolvingHall: boolean;
};

export const PREFERRED_AREA_KEY = "luwas.command.preferredArea";

export function emptyChecklist(): OnboardChecklist {
  return {
    householdsReady: false,
    staffReady: false,
    templatesReviewed: false,
    mapOpened: false,
  };
}

export function emptyDraft(): OnboardDraft {
  return {
    step: "orientation",
    areaId: null,
    barangay: "",
    lgu: "",
    name: "",
    orgName: "",
    hallAddress: "",
    hotline: "",
    email: "",
    center: null,
    zoom: 15,
    checklist: emptyChecklist(),
    resolvingHall: false,
  };
}

export function setPreferredAreaId(areaId: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PREFERRED_AREA_KEY, areaId);
  } catch {
    /* ignore */
  }
}

export function getPreferredAreaId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(PREFERRED_AREA_KEY);
  } catch {
    return null;
  }
}
