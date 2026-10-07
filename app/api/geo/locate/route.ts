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
        "User-Agent": "LuwasDRRM/0.1 (citizen location to barangay; local demo)",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const result = matchCebuBarangay({}, { lat, lng });
      return NextResponse.json({
        ...result,
        user: { lat, lng },
        nominatimDisplay: null,
      });
    }

    const data = (await res.json()) as NominatimReverse;
    const result = matchCebuBarangay(data.address ?? {}, { lat, lng });

    return NextResponse.json({
      ...result,
      user: { lat, lng },
      nominatimDisplay: data.display_name ?? null,
    });
  } catch {
    const result = matchCebuBarangay({}, { lat, lng });
    return NextResponse.json({
      ...result,
      user: { lat, lng },
      nominatimDisplay: null,
    });
  }
}
