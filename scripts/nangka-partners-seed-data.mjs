import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const NANGKA_BARANGAY_ID = "nangka-consolacion";
export const NANGKA_ORG_NAME = "Brgy. Nangka · Consolacion, Cebu";

const path = join(
  dirname(fileURLToPath(import.meta.url)),
  "nangka-partners-seed-data.json",
);

export const NANGKA_PARTNERS = JSON.parse(readFileSync(path, "utf8"));
