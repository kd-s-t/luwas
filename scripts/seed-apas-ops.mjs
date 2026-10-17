#!/usr/bin/env node
/**
 * Seed Apas evac centers, partners, and inventory into the Firestore emulator.
 * Usage: node scripts/seed-apas-ops.mjs
 */
const PROJECT = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "demo-dro";
const FS_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";

const APAS_BARANGAY_DOC_ID = "cebu-city-apas";
const APAS_ORG_NAME = "Brgy. Apas · Cebu City";
const APAS_HALL = { lat: 10.337229, lng: 123.90484 };

const EVAC = [
  {
    id: "evac-apas-hall",
    name: "Apas Barangay Hall Covered Court",
    locationLabel: "Apas · Generoso St · beside barangay hall",
    lat: APAS_HALL.lat,
    lng: APAS_HALL.lng,
    maxCapacity: 220,
    occupancy: 64,
    stock: {
      foodPacks: 100,
      waterLiters: 350,
      blankets: 50,
      medicalKits: 5,
      other: "",
    },
    notes: "Primary Apas shelter · command post nearby",
    open24h: true,
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
      foodPacks: 70,
      waterLiters: 220,
      blankets: 35,
      medicalKits: 3,
      other: "",
    },
    notes: "Classrooms + covered court used as overflow EC",
    open24h: false,
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
      foodPacks: 40,
      waterLiters: 150,
      blankets: 25,
      medicalKits: 2,
      other: "",
    },
    notes: "Secondary shelter · open on activation",
    open24h: false,
  },
];

const PARTNERS = [
  {
    id: "apas-red-cross-cebu",
    name: "Red Cross Cebu",
    type: "ngo",
    contactName: "C. Lim",
    phone: "09171234501",
    email: "c.lim@redcrosscebu.ph",
    logoUrl: "/brands/philippine-red-cross.png",
    supplies: ["medical", "shelter", "transport"],
    coverage: "Cebu City · Metro Cebu",
    notes: "Medical kits and partner transport. Confirm before allocation.",
    lat: 10.3185,
    lng: 123.9072,
  },
  {
    id: "apas-dswd-region-7",
    name: "DSWD Regional Office",
    type: "dswd",
    contactName: "Relief desk",
    phone: "09171234502",
    email: "relief.r7@dswd.gov.ph",
    logoUrl: "/brands/dswd.png",
    supplies: ["food", "water"],
    coverage: "Region VII",
    notes: "Food and water desk. Often unconfirmed until called.",
    lat: 10.3018,
    lng: 123.8916,
  },
  {
    id: "apas-cebu-city-cdrrmo",
    name: "Cebu City CDRRMO",
    type: "lgu",
    contactName: "Relief desk",
    phone: "09171234504",
    email: "cdrrmo@cebucity.gov.ph",
    logoUrl: "/brands/consolacion-ldrrmo.jpg",
    supplies: ["food", "water", "transport", "shelter"],
    coverage: "Cebu City · Metro Cebu",
    notes: "City DRRM mutual aid for Apas. Confirm before allocation.",
    lat: 10.2931,
    lng: 123.9019,
  },
  {
    id: "apas-ocd-region-7",
    name: "OCD Region VII",
    type: "lgu",
    contactName: "Coordination desk",
    phone: "09171234505",
    email: "r7@ocd.gov.ph",
    logoUrl: "/brands/ocd.png",
    supplies: ["transport", "other"],
    coverage: "Region VII",
    notes: "Coordination and logistics. Confirm before allocation.",
    lat: 10.3124,
    lng: 123.8948,
  },
  {
    id: "apas-abs-cbn-lingkod",
    name: "ABS-CBN Lingkod Kapamilya",
    type: "ngo",
    contactName: "Relief desk",
    phone: "09171234506",
    email: "relief@lingkodkapamilya.ph",
    logoUrl: "/brands/abs-cbn-lingkod.jpg",
    supplies: ["food", "water"],
    coverage: "Metro Cebu",
    notes: "Food packs and water. Confirm before allocation.",
    lat: 10.3148,
    lng: 123.8985,
  },
  {
    id: "apas-world-vision-7",
    name: "World Vision",
    type: "ngo",
    contactName: "Field desk",
    phone: "09171234508",
    email: "relief.r7@worldvision.org.ph",
    logoUrl: "/brands/world-vision.png",
    supplies: ["food", "shelter", "other"],
    coverage: "Region VII",
    notes: "Food, shelter, child kits. Confirm before allocation.",
    lat: 10.3278,
    lng: 123.9124,
  },
  {
    id: "apas-caritas-cebu",
    name: "Caritas Cebu",
    type: "ngo",
    contactName: "Social action desk",
    phone: "09171234511",
    email: "relief@caritascebu.org",
    logoUrl: "/brands/caritas.png",
    supplies: ["food", "shelter"],
    coverage: "Archdiocese of Cebu",
    notes: "Diocesan social action. Confirm before allocation.",
    lat: 10.2964,
    lng: 123.9012,
  },
  {
    id: "apas-private-donated-stock",
    name: "Private donated stock · Apas",
    type: "private",
    contactName: "Warehouse desk",
    phone: "09181234901",
    email: "donations@apas.cebu.demo",
    supplies: ["food", "water", "shelter"],
    coverage: "Apas · Cebu City",
    notes:
      "Local warehouse / mall donated stock for Apas. Confirm before allocation.",
    lat: 10.3365,
    lng: 123.9062,
  },
  {
    id: "apas-volunteer-transport-coop",
    name: "OTC transport cooperatives",
    type: "other",
    contactName: "Transport desk",
    phone: "09171234513",
    email: "r7@otc.gov.ph",
    logoUrl: "/brands/otc.png",
    supplies: ["transport"],
    coverage: "Metro Cebu",
    notes:
      "Ambulance and volunteer transport co-ops. Confirm before allocation.",
    lat: 10.3412,
    lng: 123.9286,
  },
];

const INVENTORY = [
  {
    id: "rescue-boat",
    label: "Rescue boat",
    category: "vehicle",
    unit: "boats",
    available: 0,
    location: "Barangay hall compound",
  },
  {
    id: "multicab",
    label: "Multicab / utility van",
    category: "vehicle",
    unit: "units",
    available: 3,
    location: "Hall garage",
  },
  {
    id: "generator-5kva",
    label: "Generator 5 kVA",
    category: "generator",
    unit: "units",
    available: 1,
    location: "Supply room",
  },
  {
    id: "generator-portable",
    label: "Portable generator",
    category: "generator",
    unit: "units",
    available: 2,
    location: "Supply room",
  },
  {
    id: "food-packs",
    label: "Food packs",
    category: "supply",
    unit: "packs",
    available: 160,
    location: "Relief store",
  },
  {
    id: "drinking-water",
    label: "Drinking water",
    category: "supply",
    unit: "L",
    available: 1200,
    location: "Relief store",
  },
  {
    id: "first-aid",
    label: "First-aid packs",
    category: "supply",
    unit: "packs",
    available: 10,
    location: "Clinic cabinet",
  },
  {
    id: "tarps",
    label: "Tarpaulins",
    category: "supply",
    unit: "pcs",
    available: 18,
    location: "Relief store",
  },
  {
    id: "evac-kits",
    label: "Evacuation kits",
    category: "equipment",
    unit: "kits",
    available: 8,
    location: "Relief store",
  },
  {
    id: "chainsaw",
    label: "Chainsaw",
    category: "equipment",
    unit: "units",
    available: 1,
    location: "Tool shed",
  },
];

function sv(s) {
  return { stringValue: s == null ? "" : String(s) };
}
function iv(n) {
  return { integerValue: String(Math.round(Number(n))) };
}
function dv(n) {
  return { doubleValue: Number(n) };
}
function bv(b) {
  return { booleanValue: Boolean(b) };
}
function nullV() {
  return { nullValue: null };
}
function avStrings(arr) {
  return { arrayValue: { values: (arr ?? []).map((s) => sv(s)) } };
}
function mapV(fields) {
  return { mapValue: { fields } };
}

const headers = {
  Authorization: "Bearer owner",
  "Content-Type": "application/json",
};

async function putDoc(col, id, fields) {
  const url = `http://${FS_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${col}/${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    throw new Error(`${col}/${id}: ${res.status} ${await res.text()}`);
  }
}

const now = new Date().toISOString();

for (const e of EVAC) {
  await putDoc("evacCenters", e.id, {
    name: sv(e.name),
    locationLabel: sv(e.locationLabel),
    lat: dv(e.lat),
    lng: dv(e.lng),
    maxCapacity: iv(e.maxCapacity),
    occupancy: iv(e.occupancy),
    condition: sv("usable"),
    stock: mapV({
      foodPacks: iv(e.stock.foodPacks),
      waterLiters: iv(e.stock.waterLiters),
      blankets: iv(e.stock.blankets),
      medicalKits: iv(e.stock.medicalKits),
      other: sv(e.stock.other),
    }),
    notes: sv(e.notes),
    open24h: bv(e.open24h),
    status: sv("active"),
    barangayId: sv(APAS_BARANGAY_DOC_ID),
    lgu: sv("Cebu City"),
    orgName: sv(APAS_ORG_NAME),
    createdAt: sv(now),
    updatedAt: sv(now),
  });
  console.log("evac", e.id);
}

for (const p of PARTNERS) {
  await putDoc("resourcePartners", p.id, {
    name: sv(p.name),
    type: sv(p.type),
    contactName: sv(p.contactName),
    phone: sv(p.phone),
    email: sv(p.email),
    logoUrl: p.logoUrl ? sv(p.logoUrl) : nullV(),
    lat: dv(p.lat),
    lng: dv(p.lng),
    supplies: avStrings(p.supplies),
    coverage: sv(p.coverage),
    notes: sv(p.notes),
    status: sv("active"),
    barangayId: sv(APAS_BARANGAY_DOC_ID),
    orgName: sv(APAS_ORG_NAME),
    createdAt: sv(now),
    updatedAt: sv(now),
  });
  console.log("partner", p.id);
}

for (const item of INVENTORY) {
  const id = `${APAS_BARANGAY_DOC_ID}__${item.id}`;
  await putDoc("barangayInventory", id, {
    label: sv(item.label),
    category: sv(item.category),
    unit: sv(item.unit),
    available: iv(item.available),
    location: sv(item.location),
    notes: nullV(),
    status: sv("active"),
    dispatchStatus: sv("on_hand"),
    lastDispatch: nullV(),
    history: { arrayValue: { values: [] } },
    demoStateVersion: iv(6),
    barangayId: sv(APAS_BARANGAY_DOC_ID),
    orgName: sv(APAS_ORG_NAME),
    createdAt: sv(now),
    updatedAt: sv(now),
  });
  console.log("inventory", id);
}

console.log(
  `Done · ${EVAC.length} evac · ${PARTNERS.length} partners · ${INVENTORY.length} inventory (${FS_HOST})`,
);
