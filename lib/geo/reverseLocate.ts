import {
  CEBU_BARANGAY_INDEX,
  slugify,
  type CebuLgu,
} from "@/lib/geo/cebuBarangays";
import {
  mapAreaId,
  resolveKnownMapArea,
  type MapArea,
} from "@/lib/geo/mapAreas";

export type NominatimAddress = {
  suburb?: string;
  village?: string;
  neighbourhood?: string;
  quarter?: string;
  city_district?: string;
  city?: string;
  municipality?: string;
  town?: string;
  county?: string;
  state?: string;
  country_code?: string;
};

export type LocateResult = {
  area: MapArea;
  matched: boolean;
  displayName: string;
  rawBarangay: string | null;
  rawLgu: string | null;
};

function normalizeAdmin(value: string): string {
  return value
    .replace(/^brgy\.?\s+/i, "")
    .replace(/^barangay\s+/i, "")
    .replace(/\s+city$/i, "")
    .trim();
}

function pickBarangayName(addr: NominatimAddress): string | null {
  const candidates = [
    addr.suburb,
    addr.village,
    addr.neighbourhood,
    addr.quarter,
    addr.city_district,
  ];
  for (const c of candidates) {
    if (c?.trim()) return normalizeAdmin(c);
  }
  return null;
}

function pickLguName(addr: NominatimAddress): string | null {
  const candidates = [addr.city, addr.municipality, addr.town, addr.county];
  for (const c of candidates) {
    if (c?.trim()) return normalizeAdmin(c);
  }
  return null;
}

function findLguByName(name: string): CebuLgu | undefined {
  const slug = slugify(name);
  return CEBU_BARANGAY_INDEX.lgus.find(
    (l) =>
      slugify(l.name) === slug ||
      slugify(l.name.replace(/\s+City$/i, "")) === slug ||
      slugify(`${l.name} City`) === slug,
  );
}

function findBarangayInLgu(
  lgu: CebuLgu,
  barangayName: string,
): string | undefined {
  const slug = slugify(barangayName);
  return lgu.barangays.find((b) => slugify(b) === slug);
}

/** Match Nominatim address parts to the Cebu barangay directory. */
export function matchCebuBarangay(
  addr: NominatimAddress,
  coords: { lat: number; lng: number },
): LocateResult {
  const rawBarangay = pickBarangayName(addr);
  const rawLgu = pickLguName(addr);

  let lgu = rawLgu ? findLguByName(rawLgu) : undefined;
  let barangay =
    lgu && rawBarangay ? findBarangayInLgu(lgu, rawBarangay) : undefined;

  // Ambiguous name across LGUs — prefer LGU hint, else first Cebu hit
  if (!barangay && rawBarangay) {
    const slug = slugify(rawBarangay);
    for (const candidate of CEBU_BARANGAY_INDEX.lgus) {
      const hit = candidate.barangays.find((b) => slugify(b) === slug);
      if (!hit) continue;
      if (!lgu || candidate === lgu) {
        lgu = candidate;
        barangay = hit;
        break;
      }
    }
  }

  if (lgu && barangay) {
    const option = {
      id: mapAreaId(lgu.name, barangay),
      barangay,
      lgu: lgu.name,
      name: `Brgy. ${barangay}, ${lgu.name}, Cebu`,
      label: `${barangay} · ${lgu.name}`,
    };
    const known = resolveKnownMapArea(option);
    return {
      area: {
        ...known,
        // Keep map focused on the visitor, not the hall centroid
        center: { lat: coords.lat, lng: coords.lng },
        zoom: 16,
      },
      matched: true,
      displayName: option.name,
      rawBarangay,
      rawLgu,
    };
  }

  const fallbackName =
    rawBarangay && rawLgu
      ? `Brgy. ${rawBarangay}, ${rawLgu}`
      : rawBarangay
        ? `Brgy. ${rawBarangay}`
        : rawLgu
          ? rawLgu
          : "Your location";

  return {
    area: {
      id: `gps/${coords.lat.toFixed(4)},${coords.lng.toFixed(4)}`,
      barangay: rawBarangay ?? "Unknown",
      lgu: rawLgu ?? "Cebu",
      name: fallbackName,
      center: { lat: coords.lat, lng: coords.lng },
      zoom: 15,
    },
    matched: false,
    displayName: fallbackName,
    rawBarangay,
    rawLgu,
  };
}
