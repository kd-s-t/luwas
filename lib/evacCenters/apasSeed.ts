import { APAS_HALL, APAS_ORG_NAME } from "@/lib/households/apasCuratedSeed";
import { APAS_BARANGAY_DOC_ID } from "@/lib/staff/apasStaff";
import type { EvacCenterInput } from "@/lib/evacCenters/types";
import { emptyEvacStock } from "@/lib/evacCenters/types";

export { APAS_BARANGAY_DOC_ID, APAS_ORG_NAME };

/** Seed ECs near Apas hall (Generoso St, Cebu City). */
export const APAS_EVAC_CENTER_SEED: (EvacCenterInput & {
  id: string;
  lgu: string;
})[] = [
  {
    id: "evac-apas-hall",
    name: "Apas Barangay Hall Covered Court",
    locationLabel: "Apas · Generoso St · beside barangay hall",
    lat: APAS_HALL.lat,
    lng: APAS_HALL.lng,
    maxCapacity: 220,
    occupancy: 64,
    stock: {
      ...emptyEvacStock(),
      foodPacks: 100,
      waterLiters: 350,
      blankets: 50,
      medicalKits: 5,
    },
    notes: "Primary Apas shelter · command post nearby",
    open24h: true,
    status: "active",
    lgu: "Cebu City",
  },
  {
    id: "evac-apas-elem",
    name: "Apas Elementary School",
    locationLabel: "Apas · school grounds north of Generoso",
    lat: 10.3381,
    lng: 123.9044,
    maxCapacity: 180,
    occupancy: 28,
    stock: {
      ...emptyEvacStock(),
      foodPacks: 70,
      waterLiters: 220,
      blankets: 35,
      medicalKits: 3,
    },
    notes: "Classrooms + covered court used as overflow EC",
    open24h: false,
    status: "active",
    lgu: "Cebu City",
  },
  {
    id: "evac-apas-chapel",
    name: "Apas Chapel Multi-Purpose Hall",
    locationLabel: "Apas · chapel road spur",
    lat: 10.3369,
    lng: 123.9055,
    maxCapacity: 120,
    occupancy: 0,
    stock: {
      ...emptyEvacStock(),
      foodPacks: 40,
      waterLiters: 150,
      blankets: 25,
      medicalKits: 2,
    },
    notes: "Secondary shelter · open on activation",
    open24h: false,
    status: "active",
    lgu: "Cebu City",
  },
];
