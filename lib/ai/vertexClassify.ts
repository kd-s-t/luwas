import { GoogleAuth } from "google-auth-library";

export type VertexClassifyResult = {
  className: string | null;
  confidence: number | null;
  displayNames: string[];
  confidences: number[];
  source: "vertex" | "skipped" | "error";
  reason?: string;
  endpoint?: string;
};

type VertexEnv = {
  projectId: string;
  location: string;
  endpointId: string;
};

function readVertexEnv(): VertexEnv | null {
  const projectId =
    process.env.VERTEX_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    "";
  const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";
  const endpointId = process.env.VERTEX_ENDPOINT_ID?.trim() || "";
  if (!projectId || !endpointId) return null;
  return { projectId, location, endpointId };
}

function endpointResource(env: VertexEnv): string {
  return `projects/${env.projectId}/locations/${env.location}/endpoints/${env.endpointId}`;
}

function pickTop(
  displayNames: string[],
  confidences: number[],
): { className: string | null; confidence: number | null } {
  if (!displayNames.length || !confidences.length) {
    return { className: null, confidence: null };
  }
  let best = 0;
  for (let i = 1; i < confidences.length; i++) {
    if ((confidences[i] ?? 0) > (confidences[best] ?? 0)) best = i;
  }
  return {
    className: displayNames[best] ?? null,
    confidence: confidences[best] ?? null,
  };
}

function parsePrediction(raw: unknown): {
  displayNames: string[];
  confidences: number[];
} {
  if (!raw || typeof raw !== "object") {
    return { displayNames: [], confidences: [] };
  }
  const p = raw as Record<string, unknown>;
  const displayNames = Array.isArray(p.displayNames)
    ? p.displayNames.map((x) => String(x))
    : Array.isArray(p.display_names)
      ? p.display_names.map((x) => String(x))
      : [];
  const confidences = Array.isArray(p.confidences)
    ? p.confidences.map((x) => Number(x))
    : Array.isArray(p.confidence)
      ? p.confidence.map((x) => Number(x))
      : [];
  return { displayNames, confidences };
}

/**
 * Call a deployed Vertex AutoML image classification endpoint.
 * Skips cleanly when VERTEX_PROJECT_ID / VERTEX_ENDPOINT_ID are unset.
 */
export async function classifyImageWithVertex(input: {
  imageBase64: string;
}): Promise<VertexClassifyResult> {
  const env = readVertexEnv();
  if (!env) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "skipped",
      reason:
        "Vertex not configured (set VERTEX_PROJECT_ID + VERTEX_ENDPOINT_ID).",
    };
  }

  const imageBase64 = input.imageBase64.trim();
  if (!imageBase64) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "error",
      reason: "Empty image bytes.",
    };
  }

  const resource = endpointResource(env);
  const url = `https://${env.location}-aiplatform.googleapis.com/v1/${resource}:predict`;

  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    if (!token.token) {
      return {
        className: null,
        confidence: null,
        displayNames: [],
        confidences: [],
        source: "error",
        reason: "Could not obtain Google access token for Vertex.",
        endpoint: resource,
      };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        instances: [{ content: imageBase64 }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        className: null,
        confidence: null,
        displayNames: [],
        confidences: [],
        source: "error",
        reason: `Vertex predict ${res.status}: ${text.slice(0, 180)}`,
        endpoint: resource,
      };
    }

    const data = (await res.json()) as { predictions?: unknown[] };
    const first = data.predictions?.[0];
    const { displayNames, confidences } = parsePrediction(first);
    const top = pickTop(displayNames, confidences);

    return {
      ...top,
      displayNames,
      confidences,
      source: "vertex",
      endpoint: resource,
    };
  } catch (err) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "error",
      reason: err instanceof Error ? err.message : "Vertex predict failed.",
      endpoint: resource,
    };
  }
}

/** Map claim + Vertex class into a short signal for Gemini / officers. */
export function formatVertexSignal(v: VertexClassifyResult): string {
  if (v.source === "skipped") {
    return "Vertex: skipped (endpoint not configured).";
  }
  if (v.source === "error") {
    return `Vertex: unavailable (${v.reason ?? "error"}).`;
  }
  if (!v.className || v.confidence == null) {
    return "Vertex: no prediction.";
  }
  return `Vertex vision: class="${v.className}" confidence=${v.confidence.toFixed(2)}.`;
}
