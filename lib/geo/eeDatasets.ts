/**
 * Earth Engine active datasets live in Firestore `ee_datasets/{id}`.
 * Not a file cache: command center and EE admin read this table.
 */
import { GoogleAuth } from "google-auth-library";
import {
  encodeFields,
  firestoreEmulatorHost,
} from "@/lib/reports/serverGuestWrite";

export const EE_DATASET_IDS = [
  "cebu-dem",
  "nangka-dem",
  "cebu-hazards",
] as const;

export type EeDatasetId = (typeof EE_DATASET_IDS)[number];

export type EeDatasetRow = {
  id: EeDatasetId;
  label: string;
  /** Legacy download name (e.g. cebu-ee-dem.json). */
  fileName: string;
  updatedAt: string | null;
  bytes: number;
  provider: string | null;
  projectId: string | null;
  payload: unknown | null;
};

const META: Record<
  EeDatasetId,
  { label: string; fileName: string }
> = {
  "cebu-dem": { label: "Cebu DEM", fileName: "cebu-ee-dem.json" },
  "nangka-dem": { label: "Nangka DEM", fileName: "nangka-ee-dem.json" },
  "cebu-hazards": { label: "Cebu hazards", fileName: "cebu-ee-hazards.json" },
};

const FILE_TO_ID: Record<string, EeDatasetId> = {
  "cebu-ee-dem.json": "cebu-dem",
  "nangka-ee-dem.json": "nangka-dem",
  "cebu-ee-hazards.json": "cebu-hazards",
};

export function eeDatasetIdFromFileName(fileName: string): EeDatasetId | null {
  return FILE_TO_ID[fileName] ?? null;
}

export function eeDatasetMeta(id: EeDatasetId) {
  return META[id];
}

function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "demo-dro";
}

async function googleAccessToken(): Promise<string> {
  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const value = typeof token === "string" ? token : token?.token;
  if (!value) {
    throw new Error("Could not obtain Google access token for Firestore.");
  }
  return value;
}

function docUrl(id: string): { emu: string; url: string } {
  const emu = firestoreEmulatorHost();
  const path =
    `projects/${projectId()}/databases/(default)/documents/ee_datasets/` +
    encodeURIComponent(id);
  if (emu) {
    return { emu, url: `http://${emu}/v1/${path}` };
  }
  return {
    emu: "",
    url: `https://firestore.googleapis.com/v1/${path}`,
  };
}

function decodeValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("arrayValue" in v) {
    const arr = v.arrayValue as { values?: unknown[] } | undefined;
    return (arr?.values ?? []).map(decodeValue);
  }
  if ("mapValue" in v) {
    const fields =
      (v.mapValue as { fields?: Record<string, unknown> } | undefined)
        ?.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, nested] of Object.entries(fields)) {
      out[k] = decodeValue(nested);
    }
    return out;
  }
  return value;
}

function decodeDoc(fields: Record<string, unknown> | undefined): {
  payloadJson: string | null;
  updatedAt: string | null;
  bytes: number;
  provider: string | null;
  projectId: string | null;
} {
  const raw = fields
    ? (decodeValue({ mapValue: { fields } }) as Record<string, unknown>)
    : {};
  const payloadJson =
    typeof raw.payloadJson === "string" ? raw.payloadJson : null;
  return {
    payloadJson,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    bytes: typeof raw.bytes === "number" ? raw.bytes : 0,
    provider: typeof raw.provider === "string" ? raw.provider : null,
    projectId: typeof raw.projectId === "string" ? raw.projectId : null,
  };
}

async function authHeaders(): Promise<HeadersInit> {
  const { emu } = docUrl("x");
  if (emu) return { "Content-Type": "application/json" };
  const token = await googleAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function getEeDataset(
  id: EeDatasetId,
): Promise<EeDatasetRow | null> {
  const { url } = docUrl(id);
  const res = await fetch(url, { headers: await authHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ee_datasets/${id} read ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { fields?: Record<string, unknown> };
  const decoded = decodeDoc(json.fields);
  let payload: unknown | null = null;
  if (decoded.payloadJson) {
    try {
      payload = JSON.parse(decoded.payloadJson) as unknown;
    } catch {
      payload = null;
    }
  }
  const meta = META[id];
  return {
    id,
    label: meta.label,
    fileName: meta.fileName,
    updatedAt: decoded.updatedAt,
    bytes: decoded.bytes || (decoded.payloadJson?.length ?? 0),
    provider: decoded.provider,
    projectId: decoded.projectId,
    payload,
  };
}

export async function listEeDatasets(): Promise<EeDatasetRow[]> {
  const rows: EeDatasetRow[] = [];
  for (const id of EE_DATASET_IDS) {
    const row = await getEeDataset(id);
    if (row) {
      rows.push(row);
    } else {
      const meta = META[id];
      rows.push({
        id,
        label: meta.label,
        fileName: meta.fileName,
        updatedAt: null,
        bytes: 0,
        provider: null,
        projectId: null,
        payload: null,
      });
    }
  }
  return rows;
}

export async function upsertEeDataset(
  id: EeDatasetId,
  payload: unknown,
): Promise<EeDatasetRow> {
  const meta = META[id];
  const payloadJson = `${JSON.stringify(payload)}\n`;
  const updatedAt = new Date().toISOString();
  const bytes = Buffer.byteLength(payloadJson, "utf8");
  const provider =
    payload &&
    typeof payload === "object" &&
    "provider" in payload &&
    typeof (payload as { provider?: unknown }).provider === "string"
      ? (payload as { provider: string }).provider
      : null;
  const project =
    payload &&
    typeof payload === "object" &&
    "projectId" in payload &&
    typeof (payload as { projectId?: unknown }).projectId === "string"
      ? (payload as { projectId: string }).projectId
      : null;

  const fields = encodeFields({
    id,
    label: meta.label,
    fileName: meta.fileName,
    updatedAt,
    bytes,
    provider,
    projectId: project,
    payloadJson,
  });

  const { url } = docUrl(id);
  const patchUrl = `${url}?${[
    "updateMask.fieldPaths=id",
    "updateMask.fieldPaths=label",
    "updateMask.fieldPaths=fileName",
    "updateMask.fieldPaths=updatedAt",
    "updateMask.fieldPaths=bytes",
    "updateMask.fieldPaths=provider",
    "updateMask.fieldPaths=projectId",
    "updateMask.fieldPaths=payloadJson",
  ].join("&")}`;

  const res = await fetch(patchUrl, {
    method: "PATCH",
    headers: await authHeaders(),
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `ee_datasets/${id} write ${res.status}: ${text.slice(0, 400)}`,
    );
  }

  return {
    id,
    label: meta.label,
    fileName: meta.fileName,
    updatedAt,
    bytes,
    provider,
    projectId: project,
    payload,
  };
}

export async function getEeDatasetByFileName(
  fileName: string,
): Promise<EeDatasetRow | null> {
  const id = eeDatasetIdFromFileName(fileName);
  if (!id) return null;
  return getEeDataset(id);
}
