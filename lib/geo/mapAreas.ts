import { CEBU_AREA } from "@/lib/geo/cebu";
import { CEBU_BARANGAY_INDEX, slugify } from "@/lib/geo/cebuBarangays";

export type MapArea = {
  id: string;
  barangay: string;
  lgu: string;
  name: string;
  center: { lat: number; lng: number };
  zoom: number;
};

/** Curated / approximate hall centers — Nangka is surveyed. */
const KNOWN_CENTERS: Record<string, { lat: number; lng: number; zoom?: number }> =
  {
    "consolacion/nangka": {
      lat: CEBU_AREA.center.lat,
      lng: CEBU_AREA.center.lng,
      zoom: CEBU_AREA.zoom,
    },
    "consolacion/tayud": { lat: 10.3862, lng: 123.9728, zoom: 15 },
    "consolacion/pulpogan": { lat: 10.3584, lng: 123.9486, zoom: 15 },
    "consolacion/cansaga": { lat: 10.3655, lng: 123.9682, zoom: 15 },
    "consolacion/casili": { lat: 10.3921, lng: 123.9514, zoom: 15 },
    "consolacion/poblacion-occidental": {
      lat: 10.3768,
      lng: 123.9571,
      zoom: 15,
    },
    "consolacion/poblacion-oriental": {
      lat: 10.3779,
      lng: 123.9624,
      zoom: 15,
    },
    "consolacion/lamac": { lat: 10.3512, lng: 123.9618, zoom: 15 },
    "consolacion/jugan": { lat: 10.3694, lng: 123.9412, zoom: 15 },
    "consolacion/tugbongan": { lat: 10.3458, lng: 123.9745, zoom: 15 },
    "consolacion/garing": { lat: 10.3985, lng: 123.9388, zoom: 15 },
    "consolacion/cabangahan": { lat: 10.4022, lng: 123.9621, zoom: 15 },
    "consolacion/danglag": { lat: 10.3551, lng: 123.9334, zoom: 15 },
    "consolacion/panas": { lat: 10.3898, lng: 123.9286, zoom: 15 },
    "consolacion/panoypoy": { lat: 10.3412, lng: 123.9522, zoom: 15 },
    "consolacion/pitogo": { lat: 10.3628, lng: 123.9815, zoom: 15 },
    "consolacion/polog": { lat: 10.3944, lng: 123.9782, zoom: 15 },
    "consolacion/sacsac": { lat: 10.3489, lng: 123.9381, zoom: 15 },
    "consolacion/tilhaong": { lat: 10.4112, lng: 123.9495, zoom: 15 },
    "consolacion/tolotolo": { lat: 10.3338, lng: 123.9658, zoom: 15 },
    "consolacion/lanipga": { lat: 10.4055, lng: 123.9712, zoom: 15 },
    "cebu-city/mabolo": { lat: 10.3275, lng: 123.9158, zoom: 15 },
    "cebu-city/lahug": { lat: 10.3356, lng: 123.8942, zoom: 15 },
    "mandaue-city/tipolo": { lat: 10.3331, lng: 123.9354, zoom: 15 },
  };

/** LGU fallback when barangay center unknown. */
const LGU_FALLBACK: Record<string, { lat: number; lng: number }> = {
  consolacion: { lat: 10.3765, lng: 123.9582 },
  "cebu-city": { lat: 10.3157, lng: 123.8854 },
  "mandaue-city": { lat: 10.3231, lng: 123.9223 },
  "lapu-lapu-city": { lat: 10.3103, lng: 123.9494 },
  "talisay-city": { lat: 10.2447, lng: 123.8494 },
  "city-of-naga": { lat: 10.2089, lng: 123.7581 },
  carcar: { lat: 10.1061, lng: 123.6402 },
  danao: { lat: 10.5208, lng: 124.0271 },
  toledo: { lat: 10.3773, lng: 123.6386 },
  bogo: { lat: 11.0487, lng: 124.0054 },
};

export type MapAreaOption = {
  id: string;
  barangay: string;
  lgu: string;
  name: string;
  label: string;
};

export function mapAreaId(lgu: string, barangay: string): string {
  return `${slugify(lgu)}/${slugify(barangay)}`;
}

export const DEFAULT_MAP_AREA: MapArea = {
  id: "consolacion/nangka",
  barangay: "Nangka",
  lgu: "Consolacion",
  name: CEBU_AREA.name,
  center: { ...CEBU_AREA.center },
  zoom: CEBU_AREA.zoom,
};

export function isNangkaOpsArea(area: Pick<MapArea, "id">): boolean {
  return area.id === DEFAULT_MAP_AREA.id;
}

export function listMapAreaOptions(): MapAreaOption[] {
  const rows: MapAreaOption[] = [];
  for (const lgu of CEBU_BARANGAY_INDEX.lgus) {
    for (const barangay of lgu.barangays) {
      const id = mapAreaId(lgu.name, barangay);
      rows.push({
        id,
        barangay,
        lgu: lgu.name,
        name: `Brgy. ${barangay}, ${lgu.name}, Cebu`,
        label: `${barangay} · ${lgu.name}`,
      });
    }
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveKnownMapArea(option: MapAreaOption): MapArea {
  const known = KNOWN_CENTERS[option.id];
  if (known) {
    return {
      ...option,
      center: { lat: known.lat, lng: known.lng },
      zoom: known.zoom ?? 15,
    };
  }
  const lguSlug = slugify(option.lgu);
  const fallback = LGU_FALLBACK[lguSlug] ?? LGU_FALLBACK.consolacion!;
  return {
    ...option,
    center: { ...fallback },
    zoom: 14,
  };
}

export function filterMapAreaOptions(
  options: MapAreaOption[],
  query: string,
  limit = 40,
): MapAreaOption[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    // Prefer Consolacion first when idle
    const consolacion = options.filter((o) => o.lgu === "Consolacion");
    const rest = options.filter((o) => o.lgu !== "Consolacion");
    return [...consolacion, ...rest].slice(0, limit);
  }
  return options
    .filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.name.toLowerCase().includes(q) ||
        o.barangay.toLowerCase().includes(q) ||
        o.lgu.toLowerCase().includes(q),
    )
    .slice(0, limit);
}
