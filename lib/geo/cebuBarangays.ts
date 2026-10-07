import raw from "@/lib/geo/cebuBarangays.json";

export type LguKind =
  | "highly_urbanized_city"
  | "component_city"
  | "municipality";

export type CebuLgu = {
  name: string;
  kind: LguKind;
  barangays: string[];
};

export type CebuBarangayIndex = {
  source: string;
  sourceUrl: string;
  lgus: CebuLgu[];
};

export const CEBU_BARANGAY_INDEX = raw as CebuBarangayIndex;

export function slugify(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function lguKindLabel(kind: LguKind): string {
  switch (kind) {
    case "highly_urbanized_city":
      return "Highly urbanized city";
    case "component_city":
      return "Component city";
    default:
      return "Municipality";
  }
}

export function findLgu(lguSlug: string): CebuLgu | undefined {
  return CEBU_BARANGAY_INDEX.lgus.find((l) => slugify(l.name) === lguSlug);
}

export function findBarangay(
  lguSlug: string,
  barangaySlug: string,
): { lgu: CebuLgu; barangay: string } | undefined {
  const lgu = findLgu(lguSlug);
  if (!lgu) return undefined;
  const barangay = lgu.barangays.find((b) => slugify(b) === barangaySlug);
  if (!barangay) return undefined;
  return { lgu, barangay };
}

export function totalBarangayCount(): number {
  return CEBU_BARANGAY_INDEX.lgus.reduce((n, l) => n + l.barangays.length, 0);
}
