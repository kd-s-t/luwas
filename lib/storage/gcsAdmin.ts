import { GoogleAuth } from "google-auth-library";

/** Runtime bucket for server media / EE cache (not build-time NEXT_PUBLIC). */
export function mediaStorageBucket(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() ||
    "ugnai-media-nice-pen-181017"
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
    throw new Error("Could not obtain Google access token for Storage.");
  }
  return value;
}

/** Create or overwrite an object. */
export async function gcsPutObject(input: {
  objectPath: string;
  bytes: Buffer;
  contentType: string;
}): Promise<void> {
  const bucket = mediaStorageBucket();
  const token = await googleAccessToken();
  const encodedName = encodeURIComponent(input.objectPath);
  const res = await fetch(
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage put ${res.status}: ${text.slice(0, 300)}`);
  }
}

export async function gcsGetObject(
  objectPath: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  const bucket = mediaStorageBucket();
  const token = await googleAccessToken();
  const encodedName = encodeURIComponent(objectPath);
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodedName}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage get ${res.status}: ${text.slice(0, 300)}`);
  }
  const contentType =
    res.headers.get("content-type") || "application/octet-stream";
  const ab = await res.arrayBuffer();
  return { bytes: Buffer.from(ab), contentType };
}

export async function gcsObjectMeta(
  objectPath: string,
): Promise<{ size: number; updated: string | null } | null> {
  const bucket = mediaStorageBucket();
  const token = await googleAccessToken();
  const encodedName = encodeURIComponent(objectPath);
  const res = await fetch(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodedName}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Storage meta ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { size?: string; updated?: string };
  return {
    size: Number(data.size ?? 0),
    updated: data.updated ?? null,
  };
}

export async function gcsGetJson<T>(objectPath: string): Promise<T | null> {
  const obj = await gcsGetObject(objectPath);
  if (!obj) return null;
  return JSON.parse(obj.bytes.toString("utf8")) as T;
}

export async function gcsPutJson(
  objectPath: string,
  value: unknown,
): Promise<{ bytes: number }> {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  const bytes = Buffer.from(body, "utf8");
  await gcsPutObject({
    objectPath,
    bytes,
    contentType: "application/json; charset=utf-8",
  });
  return { bytes: bytes.length };
}
