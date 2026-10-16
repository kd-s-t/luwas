import { GoogleAuth } from "google-auth-library";

export type VertexClassifyResult = {
  className: string | null;
  confidence: number | null;
  displayNames: string[];
  confidences: number[];
  /** automl = custom endpoint; vertex = Vertex Gemini publisher model. */
  source: "vertex" | "automl" | "skipped" | "error";
  reason?: string;
  endpoint?: string;
};

const VISION_CLASSES = [
  "flood",
  "fire",
  "landslide",
  "typhoon",
  "accident",
  "crime",
  "blockage",
  "evac",
  "unrelated",
] as const;

/** Vertex Gemini model for image class when AutoML endpoint is not deployed. */
const VERTEX_VISION_MODEL =
  process.env.VERTEX_VISION_MODEL?.trim() || "gemini-2.5-flash";

type VertexProject = {
  projectId: string;
  location: string;
  endpointId: string | null;
};

function readVertexProject(): VertexProject | null {
  const projectId =
    process.env.VERTEX_PROJECT_ID?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    "";
  const location = process.env.VERTEX_LOCATION?.trim() || "us-central1";
  const endpointId = process.env.VERTEX_ENDPOINT_ID?.trim() || null;
  if (!projectId) return null;
  return { projectId, location, endpointId };
}

function automlEndpointResource(env: VertexProject): string | null {
  if (!env.endpointId) return null;
  return `projects/${env.projectId}/locations/${env.location}/endpoints/${env.endpointId}`;
}

function publisherModelResource(env: VertexProject): string {
  return `projects/${env.projectId}/locations/${env.location}/publishers/google/models/${VERTEX_VISION_MODEL}`;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    return token.token ?? null;
  } catch {
    return null;
  }
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

function normalizeClass(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if ((VISION_CLASSES as readonly string[]).includes(s)) return s;
  if (/\bfire\b|sunog|blaze|flame/.test(s)) return "fire";
  if (/\bflood\b|baha/.test(s)) return "flood";
  if (/landslide|gusaw/.test(s)) return "landslide";
  if (/typhoon|bagyo|storm/.test(s)) return "typhoon";
  if (/accident|crash/.test(s)) return "accident";
  if (/crime|robbery/.test(s)) return "crime";
  if (/block|debris/.test(s)) return "blockage";
  if (/evac|shelter/.test(s)) return "evac";
  if (/unrelated|other|none/.test(s)) return "unrelated";
  return null;
}

function parseClassJson(text: string): {
  className: string | null;
  confidence: number | null;
} {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return { className: null, confidence: null };
  try {
    const parsed = JSON.parse(match[0]) as {
      className?: string;
      confidence?: number;
    };
    const className = normalizeClass(String(parsed.className ?? ""));
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence ?? 0.7)),
    );
    return { className, confidence: className ? confidence : null };
  } catch {
    return { className: null, confidence: null };
  }
}

/** Vertex AutoML custom endpoint `:predict`. */
async function classifyWithAutomlEndpoint(input: {
  env: VertexProject;
  imageBase64: string;
  token: string;
}): Promise<VertexClassifyResult> {
  const resource = automlEndpointResource(input.env);
  if (!resource) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "skipped",
      reason: "VERTEX_ENDPOINT_ID not set.",
    };
  }

  const url = `https://${input.env.location}-aiplatform.googleapis.com/v1/${resource}:predict`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: [{ content: input.imageBase64 }],
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
      reason: `AutoML predict ${res.status}: ${text.slice(0, 180)}`,
      endpoint: resource,
    };
  }

  const data = (await res.json()) as { predictions?: unknown[] };
  const { displayNames, confidences } = parsePrediction(data.predictions?.[0]);
  const top = pickTop(displayNames, confidences);
  if (!top.className) {
    return {
      className: null,
      confidence: null,
      displayNames,
      confidences,
      source: "error",
      reason: "AutoML returned no class.",
      endpoint: resource,
    };
  }

  return {
    ...top,
    displayNames,
    confidences,
    source: "automl",
    endpoint: resource,
  };
}

/**
 * Vertex AI Gemini publisher model (still Vertex API + ADC).
 * Used when no AutoML endpoint is deployed yet.
 */
async function classifyWithVertexGemini(input: {
  env: VertexProject;
  imageBase64: string;
  mimeType?: string;
  token: string;
}): Promise<VertexClassifyResult> {
  const resource = publisherModelResource(input.env);
  const url = `https://${input.env.location}-aiplatform.googleapis.com/v1/${resource}:generateContent`;
  const mimeType = input.mimeType?.trim() || "image/jpeg";
  const prompt = `Classify this citizen field-report photo for barangay disaster response.
Return ONLY JSON:
{"className":"${VISION_CLASSES.join("|")}","confidence":0-1}
Pick the single best class. Prefer "unrelated" if not a hazard scene.`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: input.imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
      },
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
      reason: `Vertex Gemini ${res.status}: ${text.slice(0, 180)}`,
      endpoint: resource,
    };
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  const parsed = parseClassJson(text);
  if (!parsed.className || parsed.confidence == null) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "error",
      reason: "Vertex Gemini returned no usable class.",
      endpoint: resource,
    };
  }

  return {
    className: parsed.className,
    confidence: parsed.confidence,
    displayNames: [parsed.className],
    confidences: [parsed.confidence],
    source: "vertex",
    endpoint: resource,
    reason: input.env.endpointId
      ? undefined
      : "Vertex Gemini vision (AutoML endpoint not deployed).",
  };
}

/**
 * Classify a report photo via Vertex AI only (ADC).
 * 1) AutoML custom endpoint when VERTEX_ENDPOINT_ID is set
 * 2) Else Vertex Gemini publisher model on the same project
 */
export async function classifyImageWithVertex(input: {
  imageBase64: string;
  mimeType?: string;
}): Promise<VertexClassifyResult> {
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

  const env = readVertexProject();
  if (!env) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "skipped",
      reason: "Set VERTEX_PROJECT_ID (and ADC) to classify via Vertex.",
    };
  }

  const token = await getAccessToken();
  if (!token) {
    return {
      className: null,
      confidence: null,
      displayNames: [],
      confidences: [],
      source: "error",
      reason:
        "Could not obtain Google access token. Run gcloud auth application-default login or set GOOGLE_APPLICATION_CREDENTIALS.",
    };
  }

  if (env.endpointId) {
    const automl = await classifyWithAutomlEndpoint({
      env,
      imageBase64,
      token,
    });
    if (automl.source === "automl" && automl.className) return automl;
    // Fall through to Vertex Gemini if AutoML predict failed.
  }

  return classifyWithVertexGemini({
    env,
    imageBase64,
    mimeType: input.mimeType,
    token,
  });
}

/** Map claim + Vertex class into a short signal for Gemini / officers. */
export function formatVertexSignal(v: VertexClassifyResult): string {
  if (v.source === "skipped") {
    return `Vertex: skipped (${v.reason ?? "not configured"}).`;
  }
  if (v.source === "error") {
    return `Vertex: unavailable (${v.reason ?? "error"}).`;
  }
  if (!v.className || v.confidence == null) {
    return "Vertex: no prediction.";
  }
  if (v.source === "automl") {
    return `Vertex AutoML: class="${v.className}" confidence=${v.confidence.toFixed(2)}.`;
  }
  return `Vertex vision: class="${v.className}" confidence=${v.confidence.toFixed(2)}.`;
}
