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
    "ugnai-media-nice-pen-181017"
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

function firestoreDocUrl(id: string): { emu: string; url: string } {
  const emu = firestoreEmulatorHost();
  if (emu) {
    return {
      emu,
      url:
        `http://${emu}/v1/projects/${projectId()}/databases/(default)/documents/reports/` +
        encodeURIComponent(id),
    };
  }
  return {
    emu: "",
    url:
      `https://firestore.googleapis.com/v1/projects/${projectId()}/databases/(default)/documents/reports/` +
      encodeURIComponent(id),
  };
}

function decodeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const v = value as Record<string, unknown>;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) {
    const fields =
      (v.mapValue as { fields?: Record<string, unknown> })?.fields ?? {};
    const out: Record<string, unknown> = {};
    for (const [k, nested] of Object.entries(fields)) {
      out[k] = decodeFirestoreValue(nested);
    }
    return out;
  }
  if ("arrayValue" in v) {
    const values =
      (v.arrayValue as { values?: unknown[] })?.values ?? [];
    return values.map(decodeFirestoreValue);
  }
  return value;
}

/** Read a report doc via Firestore REST (emulator or prod ADC). */
export async function getGuestReportDoc(
  id: string,
): Promise<Record<string, unknown> | null> {
  const { emu, url } = firestoreDocUrl(id);
  const headers: Record<string, string> = {};
  if (emu) {
    headers.Authorization = "Bearer owner";
  } else {
    headers.Authorization = `Bearer ${await googleAccessToken()}`;
  }
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Firestore read ${res.status}: ${text.slice(0, 400)}`);
  }
  const body = (await res.json()) as {
    fields?: Record<string, unknown>;
  };
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body.fields ?? {})) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

/** Write a report doc via Firestore REST (emulator or prod ADC). */
export async function putGuestReportDoc(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  await patchGuestReportFields(id, fields);
}

/**
 * Partial update with updateMask so unspecified fields are preserved.
 * Full-document callers (ios-ingest) pass every field they care about.
 */
export async function patchGuestReportFields(
  id: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const encoded = encodeFields(fields);
  const { emu, url: base } = firestoreDocUrl(id);
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const url = mask ? `${base}?${mask}` : base;

  if (emu) {
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
    const check = await fetch(base);
    if (!check.ok) {
      throw new Error(`Firestore verify failed after write (${check.status})`);
    }
    return;
  }

  const token = await googleAccessToken();
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

function guessMimeFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

/** Download guest media from local public/ (emulator) or GCS (ADC). */
export async function downloadGuestMediaBytes(
  objectPath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const cleaned = objectPath.trim().replace(/^\/+/, "");
  if (!cleaned) return null;

  // Emulator uploads land under public/reports/... (not GCS).
  if (firestoreEmulatorHost()) {
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const abs = join(process.cwd(), "public", cleaned);
      const bytes = await readFile(abs);
      if (bytes.length > 0) {
        return { bytes, contentType: guessMimeFromPath(cleaned) };
      }
    } catch {
      // Fall through to GCS in case a real object path was stored.
    }
  }

  const bucket = storageBucket();
  const token = await googleAccessToken();
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(cleaned)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage download ${res.status}: ${text.slice(0, 300)}`);
  }
  const contentType =
    res.headers.get("content-type") || "application/octet-stream";
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
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
