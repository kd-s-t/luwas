import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
import { updateHouseholdPresenceForCitizen } from "@/lib/households/api";

type LocateApiResponse = {
  area: MapArea;
  matched: boolean;
};

export type CitizenPresenceTarget = {
  uid: string;
  email: string;
  barangay?: string | null;
};

function readGpsOnce(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: 12_000,
      maximumAge: 60_000,
    });
  });
}

/**
 * Request device GPS once and write lastSeen* onto the citizen's household.
 * Best-effort: returns false if permission denied or write fails.
 */
export async function syncCitizenPresenceFromDevice(
  citizen: CitizenPresenceTarget,
): Promise<boolean> {
  const uid = citizen.uid.trim();
  const email = citizen.email.trim().toLowerCase();
  if (!uid || !email) return false;

  let pos: GeolocationPosition;
  try {
    pos = await readGpsOnce();
  } catch {
    return false;
  }

  const lat = pos.coords.latitude;
  const lng = pos.coords.longitude;
  let area: MapArea = DEFAULT_MAP_AREA;
  try {
    const res = await fetch(
      `/api/geo/locate?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`,
    );
    if (res.ok) {
      const data = (await res.json()) as LocateApiResponse;
      area = data.area;
    }
  } catch {
    /* default area label */
  }

  const homeBarangay =
    citizen.barangay?.trim() || DEFAULT_MAP_AREA.barangay;
  const updated = await updateHouseholdPresenceForCitizen(
    { uid, email },
    {
      lat,
      lng,
      areaLabel: `Brgy. ${area.barangay}, ${area.lgu}`,
      homeBarangay,
      locatedBarangay: area.barangay,
    },
  );
  return updated > 0;
}
