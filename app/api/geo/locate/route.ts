import { NextResponse } from "next/server";
import {
  matchCebuBarangay,
  type NominatimAddress,
} from "@/lib/geo/reverseLocate";

export const runtime = "nodejs";

type NominatimReverse = {
  display_name?: string;
  address?: NominatimAddress;
};

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";

/** Short-lived in-process cache (dev HMR / GPS jitter). */
const locateCache = new Map<
  string,
  { at: number; body: Record<string, unknown> }
>();
const CACHE_MS = 5 * 60_000;

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

function cachedJson(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, max-age=120",
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json(
      { error: "lat and lng are required" },
      { status: 400 },
    );
  }
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const key = cacheKey(lat, lng);
  const hit = locateCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) {
    return cachedJson(hit.body);
  }

  const store = (body: Record<string, unknown>) => {
    locateCache.set(key, { at: Date.now(), body });
    if (locateCache.size > 200) {
      const oldest = locateCache.keys().next().value;
      if (oldest) locateCache.delete(oldest);
    }
    return cachedJson(body);
  };

  // Local/emulators: skip Nominatim (slow + rate-limited); use Cebu index only.
  if (useEmulators) {
    const result = matchCebuBarangay({}, { lat, lng });
    return store({
      ...result,
      user: { lat, lng },
      nominatimDisplay: null,
    });
  }

  try {
    const url = new URL("https://nominatim.openstreetmap.org/reverse");
    url.searchParams.set("lat", String(lat));
    url.searchParams.set("lon", String(lng));
    url.searchParams.set("format", "json");
    url.searchParams.set("zoom", "16");
    url.searchParams.set("addressdetails", "1");

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "UgnaiDRRM/0.1 (citizen location to barangay; local demo)",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      const result = matchCebuBarangay({}, { lat, lng });
      return store({
        ...result,
        user: { lat, lng },
        nominatimDisplay: null,
      });
    }

    const data = (await res.json()) as NominatimReverse;
    const result = matchCebuBarangay(data.address ?? {}, { lat, lng });

    return store({
      ...result,
      user: { lat, lng },
      nominatimDisplay: data.display_name ?? null,
    });
  } catch {
    const result = matchCebuBarangay({}, { lat, lng });
    return store({
      ...result,
      user: { lat, lng },
      nominatimDisplay: null,
    });
  }
}
