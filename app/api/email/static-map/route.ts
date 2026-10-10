import { NextResponse } from "next/server";
import {
  formatDistanceKm,
  googleShelterStaticMapUrl,
  googleStaticMapUrl,
  haversineKm,
  type MapPoint,
} from "@/lib/email/alertMap";

export const runtime = "nodejs";

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function escXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Fallback schematic when Google Static Maps is unavailable. */
function schematicSvg(input: {
  homeLabel: string;
  hazLabel: string;
  kind: "eq" | "fire";
  distanceKm: number;
}): string {
  const dist = formatDistanceKm(input.distanceKm);
  const haz = input.kind === "eq" ? "Epicenter" : "Fire";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="560" viewBox="0 0 1120 560">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8f5ee"/>
      <stop offset="100%" stop-color="#d4ebe0"/>
    </linearGradient>
  </defs>
  <rect width="1120" height="560" fill="url(#bg)"/>
  <circle cx="280" cy="280" r="120" fill="none" stroke="#b7d9c6" stroke-width="2" stroke-dasharray="8 10"/>
  <circle cx="840" cy="280" r="120" fill="none" stroke="#f5c6c2" stroke-width="2" stroke-dasharray="8 10"/>
  <line x1="320" y1="280" x2="800" y2="280" stroke="#c0392b" stroke-width="4" stroke-linecap="round" opacity="0.75"/>
  <circle cx="280" cy="280" r="18" fill="#1f8f55"/>
  <circle cx="840" cy="280" r="18" fill="#c0392b"/>
  <text x="280" y="320" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0f2a1c">YOU</text>
  <text x="280" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4d6b5a">${escXml(input.homeLabel.slice(0, 42))}</text>
  <text x="840" y="320" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0f2a1c">${escXml(haz.toUpperCase())}</text>
  <text x="840" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4d6b5a">${escXml(input.hazLabel.slice(0, 42))}</text>
  <rect x="460" y="236" width="200" height="48" rx="24" fill="#ffffff" stroke="#b7d9c6"/>
  <text x="560" y="267" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="22" font-weight="700" fill="#c0392b">${escXml(dist)}</text>
</svg>`;
}

function shelterSchematicSvg(input: {
  homeLabel: string;
  destinations: { label: string; distanceKm: number }[];
}): string {
  const lines = input.destinations
    .slice(0, 5)
    .map((d, i) => {
      const y = 220 + i * 52;
      const dist = formatDistanceKm(d.distanceKm);
      return `
  <circle cx="720" cy="${y}" r="16" fill="#1d4ed8"/>
  <text x="720" y="${y + 6}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" font-weight="700" fill="#ffffff">${i + 1}</text>
  <text x="752" y="${y - 2}" font-family="system-ui,sans-serif" font-size="18" font-weight="600" fill="#0f2a1c">${escXml(d.label.slice(0, 36))}</text>
  <text x="752" y="${y + 20}" font-family="ui-monospace,Menlo,monospace" font-size="16" font-weight="700" fill="#1f8f55">${escXml(dist)}</text>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="560" viewBox="0 0 1120 560">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#e8f5ee"/>
      <stop offset="100%" stop-color="#d4ebe0"/>
    </linearGradient>
  </defs>
  <rect width="1120" height="560" fill="url(#bg)"/>
  <circle cx="220" cy="280" r="90" fill="none" stroke="#b7d9c6" stroke-width="2" stroke-dasharray="8 10"/>
  <circle cx="220" cy="280" r="20" fill="#1f8f55"/>
  <text x="220" y="330" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0f2a1c">YOU</text>
  <text x="220" y="360" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4d6b5a">${escXml(input.homeLabel.slice(0, 32))}</text>
  <text x="520" y="120" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#0f2a1c">Evacuation options</text>
  ${lines}
</svg>`;
}

function parseShelterDests(
  searchParams: URLSearchParams,
): MapPoint[] {
  const nRaw = Number(searchParams.get("n") ?? "0");
  const n = Number.isFinite(nRaw) ? Math.min(5, Math.max(0, Math.floor(nRaw))) : 0;
  const out: MapPoint[] = [];
  for (let i = 0; i < n; i++) {
    const lat = num(searchParams.get(`d${i}Lat`));
    const lng = num(searchParams.get(`d${i}Lng`));
    if (lat == null || lng == null) continue;
    out.push({
      lat,
      lng,
      label: searchParams.get(`d${i}Label`)?.trim() || `Shelter ${i + 1}`,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kindRaw = searchParams.get("kind");
  const homeLat = num(searchParams.get("homeLat"));
  const homeLng = num(searchParams.get("homeLng"));
  const homeLabel = searchParams.get("homeLabel")?.trim() || "Your home";

  if (kindRaw === "shelters") {
    if (homeLat == null || homeLng == null) {
      return NextResponse.json({ error: "Missing home coordinates" }, { status: 400 });
    }
    const home: MapPoint = { lat: homeLat, lng: homeLng, label: homeLabel };
    const destinations = parseShelterDests(searchParams);
    if (destinations.length === 0) {
      return NextResponse.json({ error: "Missing shelter destinations" }, { status: 400 });
    }

    const key = process.env.GOOGLE_WEATHER_API_KEY?.trim();
    if (key) {
      try {
        const url = googleShelterStaticMapUrl({ home, destinations, key });
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (res.ok) {
          const buf = await res.arrayBuffer();
          return new NextResponse(buf, {
            headers: {
              "Content-Type": res.headers.get("Content-Type") || "image/png",
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      } catch {
        // fall through to schematic
      }
    }

    const svg = shelterSchematicSvg({
      homeLabel,
      destinations: destinations.map((d) => ({
        label: d.label,
        distanceKm: haversineKm(home, d),
      })),
    });
    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  }

  const hazLat = num(searchParams.get("hazLat"));
  const hazLng = num(searchParams.get("hazLng"));
  const kind = kindRaw === "fire" ? "fire" : "eq";
  const hazLabel =
    searchParams.get("hazLabel")?.trim() ||
    (kind === "eq" ? "Epicenter" : "Fire");

  if (
    homeLat == null ||
    homeLng == null ||
    hazLat == null ||
    hazLng == null
  ) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const home = { lat: homeLat, lng: homeLng, label: homeLabel };
  const hazard = { lat: hazLat, lng: hazLng, label: hazLabel };
  const distanceKm = haversineKm(home, hazard);

  const key = process.env.GOOGLE_WEATHER_API_KEY?.trim();
  if (key) {
    try {
      const url = googleStaticMapUrl({ home, hazard, kind, key });
      const res = await fetch(url, { next: { revalidate: 3600 } });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new NextResponse(buf, {
          headers: {
            "Content-Type": res.headers.get("Content-Type") || "image/png",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }
    } catch {
      // fall through to schematic
    }
  }

  const svg = schematicSvg({
    homeLabel,
    hazLabel,
    kind,
    distanceKm,
  });
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=600",
    },
  });
}
