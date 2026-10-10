/** Emulator-only bootstrap proof (skips camera on first demo login). */
export const DEMO_ID_PROOF = {
  idVerified: true,
  idType: "umid" as const,
  idConfidence: 1,
  idReason: "Demo emulator bootstrap — not a production ID check.",
  idSource: "local" as const,
};

/** Local / emulator demo officer — not for production. */
export const DEMO_OFFICER = {
  displayName: "Maria Santos",
  orgName: "Brgy. Nangka MDRRMO",
  email: "officer@nangka.consolacion.demo",
  password: "demo1234",
} as const;

/** Five demo citizens for hazard field reports (emulators). */
export const DEMO_CITIZENS = [
  {
    displayName: "Juan Dela Cruz",
    email: "juan.delacruz@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 1",
    phone: "+63 917 100 0001",
  },
  {
    displayName: "Ana Reyes",
    email: "ana.reyes@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 2",
    phone: "+63 917 100 0002",
  },
  {
    displayName: "Carlo Bautista",
    email: "carlo.bautista@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 3",
    phone: "+63 917 100 0003",
  },
  {
    displayName: "Liza Mendez",
    email: "liza.mendez@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 4",
    phone: "+63 917 100 0004",
  },
  {
    displayName: "Marco Tan",
    email: "marco.tan@nangka.citizen.demo",
    password: "demo1234",
    purok: "Purok 5",
    phone: "+63 917 100 0005",
  },
  {
    displayName: "Ken Dan S. Tinio",
    email: "kendantinio@gmail.com",
    password: "demo1234",
    purok: "Purok 6",
    phone: "09606075119",
    /** Links to Ken house-owner row (same email). */
    householdEmail: "kendantinio@gmail.com",
  },
  {
    displayName: "Jeanilou Labajo",
    email: "jenlabajo.business@gmail.com",
    password: "demo1234",
    purok: "Purok 6",
    phone: "",
    /** Same house as Ken Dan Tinio. */
    householdEmail: "kendantinio@gmail.com",
  },
  {
    displayName: "Carl John Don Sebial",
    email: "inno.carljohndon@gmail.com",
    password: "demo1234",
    purok: "Purok 6",
    phone: "",
    /** Own house-owner row (neighbor of Ken). */
    householdEmail: "inno.carljohndon@gmail.com",
  },
  {
    displayName: "Patricia Abrenica",
    email: "psabrenica@gmail.com",
    password: "demo1234",
    purok: "Purok 6",
    phone: "",
    /** Own house-owner row near Access Road. */
    householdEmail: "psabrenica@gmail.com",
  },
] as const;

export type DemoCitizen = (typeof DEMO_CITIZENS)[number];

export function findDemoCitizen(email: string, password: string) {
  const normalized = email.trim().toLowerCase();
  return DEMO_CITIZENS.find(
    (c) => c.email === normalized && c.password === password,
  );
}
