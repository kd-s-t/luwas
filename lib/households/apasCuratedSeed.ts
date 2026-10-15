import type { HouseholdInput } from "@/lib/households/types";

/** Apas Barangay Hall · Generoso St (matches mapAreas curated pin). */
export const APAS_HALL = { lat: 10.337229, lng: 123.90484 } as const;

export const APAS_AREA_ID = "cebu-city/apas";
export const APAS_ORG_NAME = "Brgy. Apas · Cebu City";

/**
 * Starter house-owner pins around Apas hall / Generoso St (Cebu City).
 * Production starter roster: replace names/phones with real residents.
 */
export const CURATED_APAS_HOUSEHOLDS: HouseholdInput[] = [
  {
    ownerName: "Marco Velasco",
    address: "Beside Apas Barangay Hall, Generoso St",
    purok: "Purok 1",
    phone: "",
    email: "",
    notes: "Near hall · starter pin",
    lat: 10.33735,
    lng: 123.9047,
  },
  {
    ownerName: "Irene Cabrera",
    address: "Generoso St · west of hall",
    purok: "Purok 1",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.3371,
    lng: 123.9042,
  },
  {
    ownerName: "Paolo Mendoza",
    address: "Lane off Generoso St toward Salinas",
    purok: "Purok 2",
    phone: "",
    email: "",
    notes: "Drainage backs up in heavy rain",
    lat: 10.3367,
    lng: 123.9053,
  },
  {
    ownerName: "Janet Sy",
    address: "Residential lane north of hall",
    purok: "Purok 2",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.3378,
    lng: 123.9051,
  },
  {
    ownerName: "Ramon Go",
    address: "Near Apas Elementary approach",
    purok: "Purok 3",
    phone: "",
    email: "",
    notes: "2-storey · possible host",
    lat: 10.3382,
    lng: 123.9044,
  },
  {
    ownerName: "Carla Ong",
    address: "Purok 3 residential cluster",
    purok: "Purok 3",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.33845,
    lng: 123.905,
  },
  {
    ownerName: "Eduardo Lim",
    address: "Toward Archbishop Reyes corridor",
    purok: "Purok 4",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.3364,
    lng: 123.9041,
  },
  {
    ownerName: "Helen Dizon",
    address: "Chapel road spur, Purok 4",
    purok: "Purok 4",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.33655,
    lng: 123.9056,
  },
  {
    ownerName: "Victor Tan",
    address: "Mid Purok 5 lane",
    purok: "Purok 5",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.3376,
    lng: 123.906,
  },
  {
    ownerName: "Grace Yu",
    address: "Purok 5 east end",
    purok: "Purok 5",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.33795,
    lng: 123.9064,
  },
  {
    ownerName: "Noel Abella",
    address: "Low lot, Purok 6 drainage line",
    purok: "Purok 6",
    phone: "",
    email: "",
    notes: "Flood-prone after flash rain",
    lat: 10.3361,
    lng: 123.9059,
  },
  {
    ownerName: "Marites Quijano",
    address: "Purok 6 · near Generoso / side street",
    purok: "Purok 6",
    phone: "",
    email: "",
    notes: "Starter pin",
    lat: 10.33625,
    lng: 123.90455,
  },
];
