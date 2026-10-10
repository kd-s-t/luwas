import { appOrigin, escapeHtml } from "@/lib/email/branded";

export type MapPoint = {
  lat: number;
  lng: number;
  label: string;
};

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatDistanceKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Public img src for emails — key stays on the server proxy. */
export function alertStaticMapSrc(input: {
  home: MapPoint;
  hazard: MapPoint;
  kind: "eq" | "fire";
}): string {
  const q = new URLSearchParams({
    homeLat: String(input.home.lat),
    homeLng: String(input.home.lng),
    hazLat: String(input.hazard.lat),
    hazLng: String(input.hazard.lng),
    homeLabel: input.home.label,
    hazLabel: input.hazard.label,
    kind: input.kind,
  });
  return `${appOrigin()}/api/email/static-map?${q.toString()}`;
}

/** Google Static Maps URL (server-only). */
export function googleStaticMapUrl(input: {
  home: MapPoint;
  hazard: MapPoint;
  kind: "eq" | "fire";
  key: string;
}): string {
  const size = "560x280";
  const home = `${input.home.lat},${input.home.lng}`;
  const haz = `${input.hazard.lat},${input.hazard.lng}`;
  const midLat = (input.home.lat + input.hazard.lat) / 2;
  const midLng = (input.home.lng + input.hazard.lng) / 2;
  const span = Math.max(
    Math.abs(input.home.lat - input.hazard.lat),
    Math.abs(input.home.lng - input.hazard.lng),
  );
  // Wider framing for distant quakes; tight for nearby fires.
  const zoom = span > 0.3 ? 9 : span > 0.08 ? 11 : span > 0.02 ? 13 : 15;

  const markers = [
    `markers=color:0x1f8f55%7Clabel:Y%7C${home}`,
    `markers=color:0xc0392b%7Clabel:${input.kind === "eq" ? "E" : "F"}%7C${haz}`,
  ].join("&");
  const path = `path=color:0xc0392b99%7Cweight:3%7C${home}%7C${haz}`;

  return (
    `https://maps.googleapis.com/maps/api/staticmap?size=${size}` +
    `&scale=2&maptype=terrain&center=${midLat},${midLng}&zoom=${zoom}` +
    `&${markers}&${path}&key=${encodeURIComponent(input.key)}`
  );
}

/** Email-safe HTML: distance callout + map image + legend. */
export function alertDistanceMapHtml(input: {
  home: MapPoint;
  hazard: MapPoint;
  kind: "eq" | "fire";
  distanceKm: number;
}): string {
  const dist = formatDistanceKm(input.distanceKm);
  const mapSrc = alertStaticMapSrc(input);
  const hazTitle = input.kind === "eq" ? "Epicenter" : "Fire";
  const youTitle = "Your location";

  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;border:1px solid #b7d9c6;border-radius:12px;overflow:hidden;background:#f4faf6;">
        <tr>
          <td style="padding:14px 16px 10px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:#1f8f55;">Distance from you</p>
            <p style="margin:0;font-size:28px;line-height:1.15;font-weight:800;letter-spacing:-0.02em;color:#0f2a1c;">${escapeHtml(dist)}</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.45;color:#4d6b5a;">${escapeHtml(youTitle)} → ${escapeHtml(hazTitle)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0;line-height:0;">
            <a href="${escapeHtml(`${appOrigin()}/command`)}" style="display:block;text-decoration:none;">
              <img src="${escapeHtml(mapSrc)}" width="560" height="280" alt="Map: ${escapeHtml(dist)} from you to ${escapeHtml(hazTitle)}" style="display:block;width:100%;max-width:560px;height:auto;border:0;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:12px 16px 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td width="50%" valign="top" style="padding:0 8px 0 0;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#1f8f55;">● YOU</p>
                  <p style="margin:0;font-size:13px;line-height:1.4;color:#0f2a1c;">${escapeHtml(input.home.label)}</p>
                </td>
                <td width="50%" valign="top" style="padding:0 0 0 8px;">
                  <p style="margin:0 0 2px;font-size:11px;font-weight:700;color:#c0392b;">● ${escapeHtml(hazTitle.toUpperCase())}</p>
                  <p style="margin:0;font-size:13px;line-height:1.4;color:#0f2a1c;">${escapeHtml(input.hazard.label)}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
}

export type ShelterDest = MapPoint & { distanceKm: number };

/** Public img src for typhoon / shelter-option maps. */
export function shelterStaticMapSrc(input: {
  home: MapPoint;
  destinations: MapPoint[];
}): string {
  const q = new URLSearchParams({
    kind: "shelters",
    homeLat: String(input.home.lat),
    homeLng: String(input.home.lng),
    homeLabel: input.home.label,
  });
  input.destinations.slice(0, 5).forEach((d, i) => {
    q.set(`d${i}Lat`, String(d.lat));
    q.set(`d${i}Lng`, String(d.lng));
    q.set(`d${i}Label`, d.label);
  });
  q.set("n", String(Math.min(5, input.destinations.length)));
  return `${appOrigin()}/api/email/static-map?${q.toString()}`;
}

/** Google Static Maps — home + numbered shelter pins (server-only). */
export function googleShelterStaticMapUrl(input: {
  home: MapPoint;
  destinations: MapPoint[];
  key: string;
}): string {
  const size = "560x280";
  const home = `${input.home.lat},${input.home.lng}`;
  const dests = input.destinations.slice(0, 5);
  const markers = [
    `markers=color:0x1f8f55%7Clabel:Y%7C${home}`,
    ...dests.map(
      (d, i) =>
        `markers=color:0x1d4ed8%7Clabel:${i + 1}%7C${d.lat},${d.lng}`,
    ),
  ].join("&");
  const visible = [home, ...dests.map((d) => `${d.lat},${d.lng}`)].join("%7C");
  return (
    `https://maps.googleapis.com/maps/api/staticmap?size=${size}` +
    `&scale=2&maptype=roadmap&${markers}&visible=${visible}` +
    `&key=${encodeURIComponent(input.key)}`
  );
}

/** Email HTML: map + ordered shelter options with distance from home. */
export function shelterOptionsMapHtml(input: {
  home: MapPoint;
  destinations: ShelterDest[];
}): string {
  const dests = input.destinations.slice(0, 5);
  const nearest = dests[0] ? formatDistanceKm(dests[0].distanceKm) : "—";
  const mapSrc = shelterStaticMapSrc({
    home: input.home,
    destinations: dests,
  });
  const rows = dests
    .map((d, i) => {
      const dist = formatDistanceKm(d.distanceKm);
      return `<tr>
                <td valign="top" style="padding:8px 0;border-top:1px solid #d7ebe0;">
                  <p style="margin:0;font-size:15px;line-height:1.4;color:#0f2a1c;"><strong>${i + 1}.</strong> ${escapeHtml(d.label)}</p>
                </td>
                <td valign="top" align="right" style="padding:8px 0 8px 12px;border-top:1px solid #d7ebe0;white-space:nowrap;">
                  <p style="margin:0;font-size:15px;font-weight:700;color:#1f8f55;">${escapeHtml(dist)}</p>
                </td>
              </tr>`;
    })
    .join("");

  return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-collapse:collapse;border:1px solid #b7d9c6;border-radius:12px;overflow:hidden;background:#f4faf6;">
        <tr>
          <td style="padding:14px 16px 10px;">
            <p style="margin:0 0 4px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;font-weight:700;color:#1f8f55;">Where to evacuate</p>
            <p style="margin:0;font-size:22px;line-height:1.2;font-weight:800;letter-spacing:-0.02em;color:#0f2a1c;">Nearest shelter ${escapeHtml(nearest)}</p>
            <p style="margin:6px 0 0;font-size:13px;line-height:1.45;color:#4d6b5a;">From ${escapeHtml(input.home.label)} · save these options before landfall</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0;line-height:0;">
            <a href="${escapeHtml(`${appOrigin()}/command`)}" style="display:block;text-decoration:none;">
              <img src="${escapeHtml(mapSrc)}" width="560" height="280" alt="Map of your home and nearby evacuation centers" style="display:block;width:100%;max-width:560px;height:auto;border:0;" />
            </a>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 16px 14px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              ${rows}
            </table>
            <p style="margin:10px 0 0;font-size:12px;line-height:1.4;color:#4d6b5a;">Y = your home · numbered pins = shelters</p>
          </td>
        </tr>
      </table>`;
}
