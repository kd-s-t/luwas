import { GoogleAuth } from "google-auth-library";
import { guestMediaProxyUrl } from "@/lib/reports/mediaUrl";

function projectId(): string {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "demo-dro";
}

/**
 * Server uploads must use a runtime env (not NEXT_PUBLIC_*), because Next
 * inlines NEXT_PUBLIC_* at build time and Cloud Run env updates would be ignored.
 */
function storageBucket(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    "luwas-media-nice-pen-181017"
  );
}

export function firestoreEmulatorHost(): string {
  const useEmu = process.env.NEXT_PUBLIC_USE_EMULATORS === "true";
  return (
    process.env.FIRESTORE_EMULATOR_HOST?.trim() ||
    (useEmu ? "127.0.0.1:8080" : "")
  );
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

function encodeValue(value: unknown): Record<string, unknown> {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (Number.isInteger(value)) return { integerValue: String(value) };
    return { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return {
      arrayValue: {
        values: value.map((v) => encodeValue(v)),
      },
    };
  }
  if (typeof value === "object") {
    return {
      mapValue: { fields: encodeFields(value as Record<string, unknown>) },
    };
  }
  return { stringValue: String(value) };
}

export function encodeFields(
  fields: Record<string, unknown>,
): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const [k, v] of Object.entries(fields)) {
    out[k] = encodeValue(v);
  }
  return out;
}

/** Write a report doc via Firestore REST (emulator or prod ADC). */
export async function putGuestReportDoc(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const encoded = encodeFields(fields);
  const emu = firestoreEmulatorHost();

  if (emu) {
    const url =
      `http://${emu}/v1/projects/${projectId()}/databases/(default)/documents/reports/` +
      encodeURIComponent(id);
    const res = await fetch(url, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer owner",
      },
      body: JSON.stringify({ fields: encoded }),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Firestore write ${res.status}: ${text.slice(0, 400)}`);
    }
    const check = await fetch(url);
    if (!check.ok) {
      throw new Error(`Firestore verify failed after write (${check.status})`);
    }
    return;
  }

  const token = await googleAccessToken();
  const url =
    `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/reports/` +
    encodeURIComponent(id);
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encoded }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore write ${res.status}: ${text.slice(0, 400)}`);
  }
}

/** Upload guest media to GCS; returns a same-origin proxy URL (bucket is not Firebase-token capable). */
export async function uploadGuestMediaBytes(input: {
  objectPath: string;
  bytes: Buffer;
  contentType: string;
}): Promise<{ mediaPath: string; mediaUrl: string }> {
  const bucket = storageBucket();
  const token = await googleAccessToken();
  const encodedName = encodeURIComponent(input.objectPath);

  const upload = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodedName}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": input.contentType || "application/octet-stream",
      },
      body: new Uint8Array(input.bytes),
    },
  );
  if (!upload.ok) {
    const text = await upload.text();
    throw new Error(`Storage upload ${upload.status}: ${text.slice(0, 300)}`);
  }

  return {
    mediaPath: input.objectPath,
    mediaUrl: guestMediaProxyUrl(input.objectPath),
  };
}
