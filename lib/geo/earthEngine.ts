import { readFileSync } from "node:fs";
import { GoogleAuth } from "google-auth-library";
// CJS package — keep external via next.config serverExternalPackages.
import eeImport from "@google/earthengine";
import {
  NANGKA_ELEVATION_GRID,
  type ElevSample,
} from "@/lib/geo/nangkaElevationGrid";

/** SRTM 30 m elevation (meters). Single image — cheap one-shot sample. */
export const EE_DEM_ASSET = "USGS/SRTMGL1_003";
const EE_DEM_BAND = "elevation";

/** Cebu Island + nearby shores (one offline pull). */
export const CEBU_DEM_BBOX = {
  west: 123.35,
  south: 9.75,
  east: 124.05,
  north: 11.15,
} as const;

/** Nangka ops extent (matches static elev grid). */
export const NANGKA_DEM_BBOX = {
  west: 123.956,
  south: 10.3655,
  east: 123.9705,
  north: 10.376,
} as const;

/** Coarse Cebu grid step (~2.2 km). Kept modest so one `evaluate` stays small. */
export const CEBU_DEM_STEP_DEG = 0.02;

export type EeDemResult = {
  provider: string;
  fetchedAt: string;
  projectId: string;
  samples: ElevSample[];
  scope: "cebu" | "nangka";
};

/** @deprecated use EeDemResult */
export type NangkaEeDemResult = EeDemResult;

type PrivateKeyJson = {
  client_email: string;
  private_key: string;
  [key: string]: unknown;
};

const EE_AUTH_SCOPES = [
  "https://www.googleapis.com/auth/earthengine",
  "https://www.googleapis.com/auth/cloud-platform",
] as const;

type EeApi = {
  data: {
    authenticateViaPrivateKey: (
      privateKey: PrivateKeyJson,
      success?: () => void,
      error?: (err: unknown) => void,
    ) => void;
    setAuthToken?: (
      clientId: string,
      tokenType: string,
      accessToken: string,
      expiresIn?: number,
      extraScopes?: string[],
      callback?: () => void,
      updateAuthLibrary?: boolean,
    ) => void;
    setAuthTokenRefresher?: (
      refresher: (
        authArgs: unknown,
        callback: (result: {
          access_token?: string;
          token_type?: string;
          expires_in?: number;
          error?: unknown;
        }) => void,
      ) => void,
    ) => void;
  };
  initialize: (
    opt_baseurl?: string | null,
    opt_tileurl?: string | null,
    success?: () => void,
    error?: (err: unknown) => void,
    opt_onload?: (() => void) | null,
    opt_project?: string | null,
  ) => void;
  Image: (id: string) => {
    select: (band: string) => {
      sampleRegions: (args: {
        collection: unknown;
        scale?: number;
        geometries?: boolean;
        properties?: string[];
      }) => {
        evaluate: (
          cb: (value: { features?: unknown[] }, err?: unknown) => void,
        ) => void;
      };
    };
  };
  Geometry: {
    Point: (coords: [number, number]) => unknown;
    Rectangle: (coords: [number, number, number, number]) => unknown;
  };
  Feature: new (
    geometry: unknown,
    properties?: Record<string, unknown>,
  ) => unknown;
  FeatureCollection: (features: unknown[]) => unknown;
};

const ee = eeImport as unknown as EeApi;

export function earthEngineProjectId(): string | null {
  return (
    process.env.EARTH_ENGINE_PROJECT_ID?.trim() ||
    process.env.VERTEX_PROJECT_ID?.trim() ||
    null
  );
}

export function earthEngineConfigured(): boolean {
  return Boolean(earthEngineProjectId());
}

function loadPrivateKeyFromEnv(): PrivateKeyJson | null {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!path) return null;
  try {
    const raw = readFileSync(path, "utf8");
    const json = JSON.parse(raw) as PrivateKeyJson;
    if (!json.client_email || !json.private_key) return null;
    return json;
  } catch {
    return null;
  }
}

function promisifyInit(
  projectId: string,
  privateKey: PrivateKeyJson | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const onInitOk = () => resolve();
    const onInitErr = (err: unknown) =>
      reject(err instanceof Error ? err : new Error(String(err)));

    if (privateKey) {
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(null, null, onInitOk, onInitErr, null, projectId);
        },
        onInitErr,
      );
      return;
    }

    void (async () => {
      try {
        const auth = new GoogleAuth({
          scopes: [...EE_AUTH_SCOPES],
        });
        const client = await auth.getClient();
        const fetchToken = async (): Promise<{
          access_token: string;
          token_type: string;
          expires_in: number;
        }> => {
          const tokenResponse = await client.getAccessToken();
          const token =
            typeof tokenResponse === "string"
              ? tokenResponse
              : tokenResponse?.token;
          if (!token) {
            throw new Error(
              "No ADC access token. Set GOOGLE_APPLICATION_CREDENTIALS to an EE-registered service account JSON.",
            );
          }
          return {
            access_token: token,
            token_type: "Bearer",
            expires_in: 3600,
          };
        };

        if (typeof ee.data.setAuthToken !== "function") {
          reject(
            new Error(
              "Earth Engine ADC bridge unavailable. Set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON key.",
            ),
          );
          return;
        }

        const first = await fetchToken();
        // Keep EE tokens fresh on Cloud Run / long jobs (ADC metadata tokens expire).
        ee.data.setAuthTokenRefresher?.((_authArgs, cb) => {
          void fetchToken()
            .then((t) => cb(t))
            .catch((err) =>
              cb({
                error: err instanceof Error ? err.message : String(err),
              }),
            );
        });

        // Args: clientId, tokenType ("Bearer"), accessToken — not swapped.
        ee.data.setAuthToken(
          "",
          first.token_type,
          first.access_token,
          first.expires_in,
          [...EE_AUTH_SCOPES],
          () => {
            ee.initialize(null, null, onInitOk, onInitErr, null, projectId);
          },
          false,
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    })();
  });
}

let initOnce: Promise<void> | null = null;

/** Initialize Earth Engine once per process (service account preferred). */
export async function initEarthEngine(): Promise<{ projectId: string }> {
  const projectId = earthEngineProjectId();
  if (!projectId) {
    throw new Error(
      "EARTH_ENGINE_PROJECT_ID (or VERTEX_PROJECT_ID) is not set.",
    );
  }
  if (!initOnce) {
    const key = loadPrivateKeyFromEnv();
    initOnce = promisifyInit(projectId, key).catch((err) => {
      initOnce = null;
      throw err;
    });
  }
  await initOnce;
  return { projectId };
}

/**
 * Config/auth readiness only — does not sample DEM or spend batch compute.
 */
export async function checkEarthEngineReady(): Promise<{
  ready: boolean;
  projectId: string | null;
  error?: string;
}> {
  const projectId = earthEngineProjectId();
  if (!projectId) {
    return {
      ready: false,
      projectId: null,
      error: "EARTH_ENGINE_PROJECT_ID not set",
    };
  }
  try {
    await initEarthEngine();
    return { ready: true, projectId };
  } catch (err) {
    return {
      ready: false,
      projectId,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function inNangkaBbox(lat: number, lng: number): boolean {
  return (
    lat >= NANGKA_DEM_BBOX.south &&
    lat <= NANGKA_DEM_BBOX.north &&
    lng >= NANGKA_DEM_BBOX.west &&
    lng <= NANGKA_DEM_BBOX.east
  );
}

/** Coarse regular grid over Cebu Island (excludes Nangka fine cells). */
export function buildCebuCoarsePoints(): { lat: number; lng: number }[] {
  const pts: { lat: number; lng: number }[] = [];
  const step = CEBU_DEM_STEP_DEG;
  for (let lat = CEBU_DEM_BBOX.south; lat <= CEBU_DEM_BBOX.north + 1e-9; lat += step) {
    for (
      let lng = CEBU_DEM_BBOX.west;
      lng <= CEBU_DEM_BBOX.east + 1e-9;
      lng += step
    ) {
      const la = Math.round(lat * 1e6) / 1e6;
      const ln = Math.round(lng * 1e6) / 1e6;
      if (inNangkaBbox(la, ln)) continue;
      pts.push({ lat: la, lng: ln });
    }
  }
  return pts;
}

function parseSampleFeatures(raw: { features?: unknown[] }): ElevSample[] {
  const out: ElevSample[] = [];
  for (const f of raw.features ?? []) {
    const feat = f as {
      properties?: {
        elevation?: number;
        gridLat?: number;
        gridLng?: number;
      };
      geometry?: { coordinates?: [number, number] };
    };
    const elev = feat.properties?.elevation;
    if (typeof elev !== "number" || !Number.isFinite(elev)) continue;
    const lat =
      typeof feat.properties?.gridLat === "number"
        ? feat.properties.gridLat
        : feat.geometry?.coordinates?.[1];
    const lng =
      typeof feat.properties?.gridLng === "number"
        ? feat.properties.gridLng
        : feat.geometry?.coordinates?.[0];
    if (typeof lat !== "number" || typeof lng !== "number") continue;
    out.push({
      lat,
      lng,
      elevM: Math.round(elev * 10) / 10,
    });
  }
  return out;
}

/**
 * One Earth Engine `evaluate`: fine Nangka grid + coarse whole-Cebu grid.
 * Offline / batch only — do not call from map pan handlers.
 */
export async function sampleCebuDem(): Promise<EeDemResult> {
  const { projectId } = await initEarthEngine();

  const fine = NANGKA_ELEVATION_GRID.map((s) => ({
    lat: s.lat,
    lng: s.lng,
  }));
  const coarse = buildCebuCoarsePoints();
  const points = [...fine, ...coarse];

  const features = points.map(
    (s, i) =>
      new ee.Feature(ee.Geometry.Point([s.lng, s.lat]), {
        id: i,
        gridLat: s.lat,
        gridLng: s.lng,
      }),
  );
  const collection = ee.FeatureCollection(features);
  const dem = ee.Image(EE_DEM_ASSET).select(EE_DEM_BAND);
  const sampled = dem.sampleRegions({
    collection,
    scale: 30,
    geometries: true,
    properties: ["id", "gridLat", "gridLng"],
  });

  const raw = await new Promise<{ features?: unknown[] }>((resolve, reject) => {
    sampled.evaluate((value, err) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      resolve(value ?? {});
    });
  });

  const out = parseSampleFeatures(raw);
  if (!out.length) {
    throw new Error(
      `Earth Engine returned no DEM samples for Cebu. Check EE access and asset ${EE_DEM_ASSET}.`,
    );
  }

  return {
    provider: EE_DEM_ASSET,
    fetchedAt: new Date().toISOString(),
    projectId,
    scope: "cebu",
    samples: out,
  };
}

/** Nangka-only slice (same one-call result, filtered client-side). */
export function filterNangkaSamples(samples: ElevSample[]): ElevSample[] {
  return samples.filter((s) => inNangkaBbox(s.lat, s.lng));
}

/**
 * Sample SRTM DEM at the static Nangka grid points only (separate call).
 * Prefer `sampleCebuDem` for the demo (one call, whole Cebu + Nangka fine).
 */
export async function sampleNangkaDem(): Promise<EeDemResult> {
  const { projectId } = await initEarthEngine();
  const features = NANGKA_ELEVATION_GRID.map(
    (s, i) =>
      new ee.Feature(ee.Geometry.Point([s.lng, s.lat]), {
        id: i,
        gridLat: s.lat,
        gridLng: s.lng,
      }),
  );
  const collection = ee.FeatureCollection(features);
  const dem = ee.Image(EE_DEM_ASSET).select(EE_DEM_BAND);
  const sampled = dem.sampleRegions({
    collection,
    scale: 30,
    geometries: true,
    properties: ["id", "gridLat", "gridLng"],
  });
  const raw = await new Promise<{ features?: unknown[] }>((resolve, reject) => {
    sampled.evaluate((value, err) => {
      if (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      resolve(value ?? {});
    });
  });
  const samples = parseSampleFeatures(raw);
  if (!samples.length) {
    throw new Error(
      `Earth Engine returned no DEM samples for Nangka. Check EE access and asset ${EE_DEM_ASSET}.`,
    );
  }
  return {
    provider: EE_DEM_ASSET,
    fetchedAt: new Date().toISOString(),
    projectId,
    scope: "nangka",
    samples,
  };
}

export type EeFireHotspot = {
  lat: number;
  lng: number;
  t21: number;
  confidence?: number;
};

function firmsDateWindows(days: number): { startIso: string; endIso: string; label: string }[] {
  const end = new Date();
  const recentStart = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const year = end.getUTCFullYear();
  // Cebu wet season often has zero FIRMS hits; dry season is the useful demo layer.
  const dryYear = end.getUTCMonth() < 5 ? year - 1 : year;
  return [
    {
      startIso: recentStart.toISOString().slice(0, 10),
      endIso: end.toISOString().slice(0, 10),
      label: `last ${days}d`,
    },
    {
      startIso: `${dryYear}-02-01`,
      endIso: `${dryYear}-05-01`,
      label: `dry ${dryYear}`,
    },
  ];
}

/**
 * FIRMS (MODIS) hotspots over Cebu. Tries recent window, then dry-season fallback.
 */
export async function sampleCebuFires(
  days = 90,
): Promise<{ projectId: string; hotspots: EeFireHotspot[]; window: string }> {
  const { projectId } = await initEarthEngine();
  // FIRMS ImageCollection API is broader than our typed EE subset.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eeAny = ee as any;

  const region = eeAny.Geometry.Rectangle([
    CEBU_DEM_BBOX.west,
    CEBU_DEM_BBOX.south,
    CEBU_DEM_BBOX.east,
    CEBU_DEM_BBOX.north,
  ]);

  for (const win of firmsDateWindows(days)) {
    const firms = eeAny
      .ImageCollection("FIRMS")
      .filterDate(win.startIso, win.endIso)
      .filterBounds(region)
      .select("T21")
      .max();

    const hotMask = firms.gte(300).selfMask();
    const vectors = hotMask.reduceToVectors({
      geometry: region,
      scale: 1000,
      geometryType: "centroid",
      eightConnected: false,
      labelProperty: "fire",
      maxPixels: 1e9,
    });

    const raw = await new Promise<{ features?: unknown[] }>((resolve, reject) => {
      vectors.limit(200).evaluate(
        (value: { features?: unknown[] }, err: unknown) => {
          if (err) {
            reject(err instanceof Error ? err : new Error(String(err)));
            return;
          }
          resolve(value ?? {});
        },
      );
    });

    const hotspots: EeFireHotspot[] = [];
    for (const f of raw.features ?? []) {
      const feat = f as {
        geometry?: { coordinates?: [number, number] };
        properties?: { mean?: number; T21?: number };
      };
      const coords = feat.geometry?.coordinates;
      if (!coords || coords.length < 2) continue;
      const lng = coords[0]!;
      const lat = coords[1]!;
      const t21 =
        typeof feat.properties?.mean === "number"
          ? feat.properties.mean
          : typeof feat.properties?.T21 === "number"
            ? feat.properties.T21
            : 320;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || t21 < 300) continue;
      hotspots.push({ lat, lng, t21 });
    }

    if (hotspots.length) {
      return { projectId, hotspots, window: win.label };
    }
  }

  return { projectId, hotspots: [], window: "none" };
}
