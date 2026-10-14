"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isCitizen } from "@/lib/auth/types";
import { DEFAULT_MAP_AREA, type MapArea } from "@/lib/geo/mapAreas";
import { updateHouseholdPresenceForCitizen } from "@/lib/households/api";

type LocateApiResponse = {
  area: MapArea;
  matched: boolean;
};

const REFRESH_MS = 5 * 60_000;

/**
 * While a citizen is signed in, request GPS and write lastSeen* onto their
 * house-owner row so /overview/households shows last location.
 */
export function CitizenPresenceSync() {
  const { profile } = useAuth();
  const lastOkAt = useRef(0);

  const uid = profile?.uid ?? "";
  const email = profile?.email ?? "";
  const barangay = profile?.barangay?.trim() || "";
  const canSync =
    isCitizen(profile) && isAccountActive(profile) && Boolean(uid && email);

  useEffect(() => {
    if (!canSync) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let cancelled = false;
    const homeBarangay = barangay || DEFAULT_MAP_AREA.barangay;

    async function publish(lat: number, lng: number) {
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
        /* use default home barangay label */
      }
      if (cancelled) return;
      await updateHouseholdPresenceForCitizen(
        { uid, email },
        {
          lat,
          lng,
          areaLabel: `Brgy. ${area.barangay}, ${area.lgu}`,
          homeBarangay,
          locatedBarangay: area.barangay,
        },
      );
      lastOkAt.current = Date.now();
    }

    function locate() {
      if (cancelled) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          void publish(pos.coords.latitude, pos.coords.longitude).catch(
            () => {
              /* permission / rules / offline — best effort */
            },
          );
        },
        () => {
          /* denied or unavailable */
        },
        {
          enableHighAccuracy: false,
          timeout: 12_000,
          maximumAge: 2 * 60_000,
        },
      );
    }

    // Let the first paint finish, then ask for location.
    const startId = window.setTimeout(locate, 800);
    const intervalId = window.setInterval(() => {
      if (Date.now() - lastOkAt.current < REFRESH_MS - 5_000) return;
      locate();
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(startId);
      window.clearInterval(intervalId);
    };
  }, [canSync, uid, email, barangay]);

  return null;
}
