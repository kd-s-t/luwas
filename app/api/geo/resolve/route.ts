import { NextResponse } from "next/server";
import { resolveKnownMapArea, type MapAreaOption } from "@/lib/geo/mapAreas";

export const runtime = "nodejs";

type Body = {
  id: string;
  barangay: string;
  lgu: string;
  name: string;
  label: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const option: MapAreaOption = {
    id: body.id,
    barangay: body.barangay,
    lgu: body.lgu,
    name: body.name,
    label: body.label,
  };

  const fallback = resolveKnownMapArea(option);

  try {
    const q = encodeURIComponent(
      `Barangay ${option.barangay}, ${option.lgu}, Cebu, Philippines`,
    );
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "LuwasDRRM/0.1 (barangay map switcher; local demo)",
        },
        next: { revalidate: 86400 },
      },
    );
    if (!res.ok) {
      return NextResponse.json(fallback);
    }
    const rows = (await res.json()) as { lat: string; lon: string }[];
    const hit = rows[0];
    if (!hit) {
      return NextResponse.json(fallback);
    }
    return NextResponse.json({
      ...option,
      center: { lat: Number(hit.lat), lng: Number(hit.lon) },
      zoom: 15,
    });
  } catch {
    return NextResponse.json(fallback);
  }
}
