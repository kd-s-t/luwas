/** Curated Consolacion / metro Cebu places — aligned with iOS ServiceAreaPlaces. */

export type ServiceAreaPlace = {
  id: string;
  barangay: string;
  lgu: string;
  lat: number;
  lng: number;
};

export function placeLabel(p: ServiceAreaPlace): string {
  return `Brgy. ${p.barangay}, ${p.lgu}`;
}

export const NANGKA_HALL = {
  lat: 10.3708662,
  lng: 123.9590464,
} as const;

export const SERVICE_AREA_PLACES: ServiceAreaPlace[] = [
  {
    id: "consolacion/nangka",
    barangay: "Nangka",
    lgu: "Consolacion",
    lat: 10.3708662,
    lng: 123.9590464,
  },
  {
    id: "consolacion/tayud",
    barangay: "Tayud",
    lgu: "Consolacion",
    lat: 10.3862,
    lng: 123.9728,
  },
  {
    id: "consolacion/pulpogan",
    barangay: "Pulpogan",
    lgu: "Consolacion",
    lat: 10.3584,
    lng: 123.9486,
  },
  {
    id: "consolacion/cansaga",
    barangay: "Cansaga",
    lgu: "Consolacion",
    lat: 10.3655,
    lng: 123.9682,
  },
  {
    id: "consolacion/casili",
    barangay: "Casili",
    lgu: "Consolacion",
    lat: 10.3921,
    lng: 123.9514,
  },
  {
    id: "consolacion/poblacion-occidental",
    barangay: "Poblacion Occidental",
    lgu: "Consolacion",
    lat: 10.3768,
    lng: 123.9571,
  },
  {
    id: "consolacion/lamac",
    barangay: "Lamac",
    lgu: "Consolacion",
    lat: 10.3512,
    lng: 123.9618,
  },
  {
    id: "mandaue-city/tipolo",
    barangay: "Tipolo",
    lgu: "Mandaue City",
    lat: 10.3331,
    lng: 123.9354,
  },
  {
    id: "cebu-city/mabolo",
    barangay: "Mabolo",
    lgu: "Cebu City",
    lat: 10.3275,
    lng: 123.9158,
  },
];

export function filterPlaces(query: string): ServiceAreaPlace[] {
  const q = query.trim().toLowerCase();
  if (!q) return SERVICE_AREA_PLACES.slice(0, 8);
  const hits = SERVICE_AREA_PLACES.filter(
    (p) =>
      placeLabel(p).toLowerCase().includes(q) ||
      p.barangay.toLowerCase().includes(q) ||
      p.lgu.toLowerCase().includes(q),
  );
  return (hits.length ? hits : SERVICE_AREA_PLACES).slice(0, 8);
}
