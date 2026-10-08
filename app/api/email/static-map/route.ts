import { NextResponse } from "next/server";
import {
  formatDistanceKm,
  googleStaticMapUrl,
  haversineKm,
} from "@/lib/email/alertMap";

export const runtime = "nodejs";

function num(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
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
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

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
  <text x="280" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4d6b5a">${esc(input.homeLabel.slice(0, 42))}</text>
  <text x="840" y="320" text-anchor="middle" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#0f2a1c">${esc(haz.toUpperCase())}</text>
  <text x="840" y="350" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#4d6b5a">${esc(input.hazLabel.slice(0, 42))}</text>
  <rect x="460" y="236" width="200" height="48" rx="24" fill="#ffffff" stroke="#b7d9c6"/>
  <text x="560" y="267" text-anchor="middle" font-family="ui-monospace,Menlo,monospace" font-size="22" font-weight="700" fill="#c0392b">${esc(dist)}</text>
</svg>`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const homeLat = num(searchParams.get("homeLat"));
  const homeLng = num(searchParams.get("homeLng"));
  const hazLat = num(searchParams.get("hazLat"));
  const hazLng = num(searchParams.get("hazLng"));
  const kindRaw = searchParams.get("kind");
  const kind = kindRaw === "fire" ? "fire" : "eq";
  const homeLabel = searchParams.get("homeLabel")?.trim() || "Your home";
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
