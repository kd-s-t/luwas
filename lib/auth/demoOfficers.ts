import { DEMO_ID_PROOF, DEMO_OFFICER } from "@/lib/auth/demoAccount";

export type DemoOfficer = {
  id: string;
  label: string;
  displayName: string;
  orgName: string;
  email: string;
  password: string;
  staffTitle: string;
  areaId: string;
  barangay: string;
  lgu: string;
  /** Punong Barangay / hire-fire captain stamp. */
  officerRank?: "captain" | "officer";
};

/** Officer demo logins (Nangka + Apas + LGU). */
export const DEMO_OFFICERS: DemoOfficer[] = [
  {
    id: "captain",
    label: "Barangay Captain",
    displayName: "Hon. Ricardo Villanueva",
    orgName: "Brgy. Nangka · Punong Barangay",
    email: "captain@nangka.consolacion.demo",
    password: "demo1234",
    staffTitle: "Punong Barangay",
    areaId: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    officerRank: "captain",
  },
  {
    id: "apas-captain",
    label: "Brgy. Apas Captain",
    displayName: "Hon. Liza Padilla",
    orgName: "Brgy. Apas · Punong Barangay",
    email: "captain@apas.cebu.demo",
    password: "demo1234",
    staffTitle: "Punong Barangay",
    areaId: "cebu-city/apas",
    barangay: "Apas",
    lgu: "Cebu City",
    officerRank: "captain",
  },
  {
    id: "mdrrmo",
    label: "MDRRMO Focal",
    displayName: DEMO_OFFICER.displayName,
    orgName: DEMO_OFFICER.orgName,
    email: DEMO_OFFICER.email,
    password: DEMO_OFFICER.password,
    staffTitle: "BDRRMC Coordinator · MDRRMO Focal",
    areaId: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    officerRank: "officer",
  },
  {
    id: "lgu",
    label: "LGU / Consolacion MDRRMO",
    displayName: "Atty. Carla Mendoza",
    orgName: "Consolacion MDRRMO",
    email: "lgu@consolacion.demo",
    password: "demo1234",
    staffTitle: "Municipal MDRRMO Officer",
    areaId: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    officerRank: "officer",
  },
];

export function findDemoOfficer(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  return DEMO_OFFICERS.find(
    (o) => o.email === normalized && o.password === password,
  );
}

export { DEMO_ID_PROOF };
