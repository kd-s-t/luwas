import type { HouseholdInput } from "@/lib/households/types";

const HEADER_ALIASES: Record<keyof HouseholdInput | "ownerName", string[]> = {
  ownerName: [
    "ownername",
    "owner_name",
    "owner",
    "name",
    "houseowner",
    "house_owner",
    "household",
  ],
  address: ["address", "landmark", "address_landmark", "addr"],
  purok: ["purok", "sitio", "purok_sitio", "zone"],
  phone: ["phone", "sms", "mobile", "contact", "phone_sms", "cellphone"],
  email: ["email", "mail"],
  notes: ["notes", "note", "remarks", "comment"],
  lat: ["lat", "latitude", "y"],
  lng: ["lng", "lon", "long", "longitude", "x"],
};

export const HOUSEHOLD_CSV_TEMPLATE = `ownerName,address,purok,phone,email,notes,lat,lng
Jose Reyes,"Near Nangka Barangay Hall",Purok 1,09171234501,jose@example.com,Tanod · 5 members,10.370744,123.959104
Ana Cruz,"Beside Sto. Niño Chapel",Purok 1,09181234502,,Elderly mother,10.371009,123.959389
`;

function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s/\-]+/g, "_");
}

function mapHeader(raw: string): keyof HouseholdInput | null {
  const key = normalizeHeader(raw);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [
    keyof HouseholdInput,
    string[],
  ][]) {
    if (aliases.includes(key)) return field;
  }
  return null;
}

/** Minimal CSV row split — supports quotes and commas inside quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

export type CsvParseResult = {
  rows: HouseholdInput[];
  skipped: number;
  errors: string[];
};

export function parseHouseholdCsv(text: string): CsvParseResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length < 2) {
    return {
      rows: [],
      skipped: 0,
      errors: ["CSV needs a header row and at least one data row."],
    };
  }

  const headers = splitCsvLine(lines[0]).map(mapHeader);
  if (!headers.includes("ownerName") || !headers.includes("address")) {
    return {
      rows: [],
      skipped: 0,
      errors: [
        "CSV header must include ownerName and address (or aliases like name, landmark).",
      ],
    };
  }

  const rows: HouseholdInput[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const draft: Partial<HouseholdInput> = {
      ownerName: "",
      address: "",
      purok: "",
      phone: "",
      email: "",
      notes: "",
    };

    headers.forEach((field, idx) => {
      if (!field) return;
      const raw = cols[idx] ?? "";
      if (field === "lat" || field === "lng") {
        const n = Number(raw);
        if (raw !== "" && Number.isFinite(n)) {
          draft[field] = n;
        }
        return;
      }
      draft[field] = raw;
    });

    const ownerName = (draft.ownerName ?? "").trim();
    const address = (draft.address ?? "").trim();
    const phone = (draft.phone ?? "").trim();

    if (!ownerName && !address) {
      skipped += 1;
      continue;
    }
    if (!ownerName || !address || !phone) {
      skipped += 1;
      errors.push(
        `Row ${i + 1}: need ownerName, address, and phone (skipped).`,
      );
      continue;
    }

    rows.push({
      ownerName,
      address,
      purok: (draft.purok ?? "").trim(),
      phone,
      email: (draft.email ?? "").trim(),
      notes: (draft.notes ?? "").trim(),
      lat: typeof draft.lat === "number" ? draft.lat : undefined,
      lng: typeof draft.lng === "number" ? draft.lng : undefined,
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push("No valid household rows found in CSV.");
  }

  return { rows, skipped, errors };
}
