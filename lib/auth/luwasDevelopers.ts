/** The only LUWAS developer accounts (About us team). */

export type LuwasDeveloper = {
  id: string;
  slug: string;
  name: string;
  short: string;
  role: string;
  focus: string;
  email: string;
  password: string;
  bio: string;
};

export const LUWAS_DEVELOPERS: readonly LuwasDeveloper[] = [
  {
    id: "ken",
    slug: "ken-dan-tinio",
    name: "Ken Dan Tinio",
    short: "Ken",
    role: "Fullstack Engineer",
    focus: "Product and platform",
    email: "ken@luwas.demo",
    password: "demo1234",
    bio: "Owns the LUWAS web stack end to end: Next.js command center and citizen flows, Firebase auth and Firestore, Cloud Run / Hosting deploy, AI triage and validation wiring (Gemini + Vertex), alerts (SMS, email, voice), and the APIs that keep field reports moving from guest ingest to officer queue.",
  },
  {
    id: "don",
    slug: "don-sebial",
    name: "Don Sebial",
    short: "Don",
    role: "Product Designer",
    focus: "UI/UX and Graphic Design",
    email: "don@luwas.demo",
    password: "demo1234",
    bio: "Shapes how LUWAS looks and feels: brand direction, map and command layout, citizen report UX, motion, and graphic assets so officers and residents can read urgency at a glance without clutter.",
  },
  {
    id: "jean",
    slug: "jeanilou-labajo",
    name: "Jeanilou Labajo",
    short: "Jean",
    role: "System Analyst",
    focus: "Quality and field checks",
    email: "jean@luwas.demo",
    password: "demo1234",
    bio: "Runs quality passes across citizen and officer paths: registration and login, guest and signed-in reporting, triage and map layers, and regression checks before a release so demo and ops scenarios stay trustworthy.",
  },
  {
    id: "pat",
    slug: "patricia-abrenica",
    name: "Patricia Abrenica",
    short: "Pat",
    role: "Application Support Analyst",
    focus: "Support and acceptance",
    email: "pat@luwas.demo",
    password: "demo1234",
    bio: "An Accenture Custom Software Engineer designs, codes, tests, and enhances custom software solutions and applications using modern frameworks and agile methodologies.",
  },
] as const;

export function findLuwasDeveloper(
  email: string,
  password?: string,
): LuwasDeveloper | null {
  const mail = email.trim().toLowerCase();
  const hit = LUWAS_DEVELOPERS.find((d) => d.email.toLowerCase() === mail);
  if (!hit) return null;
  if (password != null && password !== hit.password) return null;
  return hit;
}

export function isLuwasDeveloperEmail(email: string): boolean {
  return Boolean(findLuwasDeveloper(email));
}
