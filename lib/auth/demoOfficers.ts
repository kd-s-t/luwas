import { DEMO_ID_PROOF, DEMO_OFFICER } from "@/lib/auth/demoAccount";

/** Officer demo logins (captain, MDRRMO focal, LGU). */
export const DEMO_OFFICERS = [
  {
    id: "captain",
    label: "Barangay Captain",
    displayName: "Hon. Ricardo Villanueva",
    orgName: "Brgy. Nangka · Punong Barangay",
    email: "captain@nangka.consolacion.demo",
    password: "demo1234",
    staffTitle: "Punong Barangay",
  },
  {
    id: "mdrrmo",
    label: "MDRRMO Focal",
    displayName: DEMO_OFFICER.displayName,
    orgName: DEMO_OFFICER.orgName,
    email: DEMO_OFFICER.email,
    password: DEMO_OFFICER.password,
    staffTitle: "BDRRMC Coordinator · MDRRMO Focal",
  },
  {
    id: "lgu",
    label: "LGU / Consolacion MDRRMO",
    displayName: "Atty. Carla Mendoza",
    orgName: "Consolacion MDRRMO",
    email: "lgu@consolacion.demo",
    password: "demo1234",
    staffTitle: "Municipal MDRRMO Officer",
  },
] as const;

export type DemoOfficer = (typeof DEMO_OFFICERS)[number];

export function findDemoOfficer(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  return DEMO_OFFICERS.find(
    (o) => o.email === normalized && o.password === password,
  );
}

export { DEMO_ID_PROOF };
