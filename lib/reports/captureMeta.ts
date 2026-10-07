export type ReportCaptureMeta = {
  lat: number | null;
  lng: number | null;
  locationAccuracyM: number | null;
  locationLabel: string;
  device: string;
  ipAddress: string | null;
};

function parseDevice(ua: string): string {
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android\s([\d.]+)/i);
    return m ? `Android ${m[1]}` : "Android";
  }
  if (/Mac OS X/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown device";
}

export function isMobileClient(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /Mobile|Android|iPhone|iPad/i.test(ua);
}

export function readDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent || "";
  const platform = parseDevice(ua);
  const mobile = isMobileClient();
  return `${platform}${mobile ? " · mobile" : " · desktop"}`;
}

function readGps(): Promise<{
  lat: number;
  lng: number;
  accuracy: number | null;
}> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation not available"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy:
            typeof pos.coords.accuracy === "number"
              ? pos.coords.accuracy
              : null,
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });
}

async function readIp(): Promise<string | null> {
  try {
    const res = await fetch("/api/geo/client-ip", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: string };
    return data.ip?.trim() || null;
  } catch {
    return null;
  }
}

/** Auto-collect GPS, device, and IP — nothing is typed by the poster. */
export async function captureReportMeta(): Promise<ReportCaptureMeta> {
  const device = readDeviceLabel();
  const ipPromise = readIp();

  let lat: number | null = null;
  let lng: number | null = null;
  let locationAccuracyM: number | null = null;
  let locationLabel = "Location unavailable";

  try {
    const gps = await readGps();
    lat = gps.lat;
    lng = gps.lng;
    locationAccuracyM = gps.accuracy;
    const acc =
      gps.accuracy != null ? ` ±${Math.round(gps.accuracy)} m` : "";
    locationLabel = `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}${acc}`;
  } catch {
    locationLabel = "Location denied or unavailable";
  }

  const ipAddress = await ipPromise;

  return {
    lat,
    lng,
    locationAccuracyM,
    locationLabel,
    device,
    ipAddress,
  };
}
