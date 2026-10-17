import { GoogleAuth } from "google-auth-library";
import {
  filterPlaces,
  matchPlace,
  placeLabel,
  type ServiceAreaPlace,
} from "@/lib/reports/serviceAreaPlaces";

export type VertexClassifyResult = {
  className: string | null;
  confidence: number | null;
  displayNames: string[];
  confidences: number[];
  /** Visual place guess from the photo (landmark / street / barangay cue). */
  locationLabel: string | null;
  locationConfidence: number | null;
  /** Matched curated service-area place id when the vision label resolves. */
  locationPlaceId: string | null;
  locationPlaceLabel: string | null;
  /** automl = custom endpoint class; vertex = Vertex Gemini (class + location). */
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

function emptyResult(
  partial: Partial<VertexClassifyResult> &
    Pick<VertexClassifyResult, "source">,
): VertexClassifyResult {
  return {
    className: null,
    confidence: null,
    displayNames: [],
    confidences: [],
    locationLabel: null,
    locationConfidence: null,
    locationPlaceId: null,
    locationPlaceLabel: null,
    ...partial,
  };
}

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

/** Map free-text vision place → curated Consolacion / metro place when possible. */
export function matchPlaceFromVision(
  label: string,
): ServiceAreaPlace | null {
  const trimmed = label.trim();
  if (!trimmed) return null;
  const exact = matchPlace(trimmed);
  if (exact) return exact;
  const hits = filterPlaces(trimmed);
  if (hits.length === 1) return hits[0]!;
  // Prefer landmark hits when several match.
  const landmark = hits.find((p) => p.landmark?.trim());
  if (landmark) return landmark;
  return hits[0] ?? null;
}

function attachPlaceMatch(
  locationLabel: string | null,
  locationConfidence: number | null,
): Pick<
  VertexClassifyResult,
  | "locationLabel"
  | "locationConfidence"
  | "locationPlaceId"
  | "locationPlaceLabel"
> {
  if (!locationLabel) {
    return {
      locationLabel: null,
      locationConfidence: null,
      locationPlaceId: null,
      locationPlaceLabel: null,
    };
  }
  const place = matchPlaceFromVision(locationLabel);
  return {
    locationLabel: locationLabel.slice(0, 160),
    locationConfidence,
    locationPlaceId: place?.id ?? null,
    locationPlaceLabel: place ? placeLabel(place) : null,
  };
}

function parseVisionJson(text: string): {
  className: string | null;
  confidence: number | null;
  locationLabel: string | null;
  locationConfidence: number | null;
} {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return {
      className: null,
      confidence: null,
      locationLabel: null,
      locationConfidence: null,
    };
  }
  try {
    const parsed = JSON.parse(match[0]) as {
      className?: string;
      confidence?: number;
      locationLabel?: string;
      locationConfidence?: number;
      location?: string;
    };
    const className = normalizeClass(String(parsed.className ?? ""));
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence ?? 0.7)),
    );
    const locationRaw = String(
      parsed.locationLabel ?? parsed.location ?? "",
    ).trim();
    const locationLabel = locationRaw ? locationRaw.slice(0, 160) : null;
    const locationConfidence = locationLabel
      ? Math.max(
          0,
          Math.min(1, Number(parsed.locationConfidence ?? 0.55)),
        )
      : null;
    return {
      className,
      confidence: className ? confidence : null,
      locationLabel,
      locationConfidence,
    };
  } catch {
    return {
      className: null,
      confidence: null,
      locationLabel: null,
      locationConfidence: null,
    };
  }
}

/** Vertex AutoML custom endpoint `:predict` (hazard class only). */
async function classifyWithAutomlEndpoint(input: {
  env: VertexProject;
  imageBase64: string;
  token: string;
}): Promise<VertexClassifyResult> {
  const resource = automlEndpointResource(input.env);
  if (!resource) {
    return emptyResult({
      source: "skipped",
      reason: "VERTEX_ENDPOINT_ID not set.",
    });
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
    return emptyResult({
      source: "error",
      reason: `AutoML predict ${res.status}: ${text.slice(0, 180)}`,
      endpoint: resource,
    });
  }

  const data = (await res.json()) as { predictions?: unknown[] };
  const { displayNames, confidences } = parsePrediction(data.predictions?.[0]);
  const top = pickTop(displayNames, confidences);
  if (!top.className) {
    return emptyResult({
      displayNames,
      confidences,
      source: "error",
      reason: "AutoML returned no class.",
      endpoint: resource,
    });
  }

  return emptyResult({
    ...top,
    displayNames,
    confidences,
    source: "automl",
    endpoint: resource,
  });
}

/**
 * Vertex AI Gemini publisher model: hazard class + visual location.
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
  const prompt = `Classify this citizen field-report photo for barangay disaster response in Consolacion / metro Cebu (Philippines).
Return ONLY JSON:
{"className":"${VISION_CLASSES.join("|")}","confidence":0-1,"locationLabel":"short place from visual cues","locationConfidence":0-1}
Rules:
- className: single best hazard class. Prefer "unrelated" if not a hazard scene.
- locationLabel: where the photo appears to be (barangay, landmark, street type, subdivision, mall, coast, etc.). Use Philippine place cues when visible. If unknown, use "unknown".
- locationConfidence: how sure you are about the place (0-1).`;

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
        maxOutputTokens: 320,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return emptyResult({
      source: "error",
      reason: `Vertex Gemini ${res.status}: ${text.slice(0, 180)}`,
      endpoint: resource,
    });
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
  const parsed = parseVisionJson(text);
  if (!parsed.className || parsed.confidence == null) {
    return emptyResult({
      ...attachPlaceMatch(parsed.locationLabel, parsed.locationConfidence),
      source: "error",
      reason: "Vertex Gemini returned no usable class.",
      endpoint: resource,
    });
  }

  const location =
    parsed.locationLabel &&
    parsed.locationLabel.toLowerCase() !== "unknown"
      ? attachPlaceMatch(parsed.locationLabel, parsed.locationConfidence)
      : {
          locationLabel: null,
          locationConfidence: null,
          locationPlaceId: null,
          locationPlaceLabel: null,
        };

  return {
    className: parsed.className,
    confidence: parsed.confidence,
    displayNames: [parsed.className],
    confidences: [parsed.confidence],
    ...location,
    source: "vertex",
    endpoint: resource,
    reason: input.env.endpointId
      ? undefined
      : "Vertex Gemini vision (AutoML endpoint not deployed).",
  };
}

/**
 * Classify a report photo via Vertex AI only (ADC).
 * Always runs Vertex Gemini for hazard + visual location.
 * When VERTEX_ENDPOINT_ID is set, AutoML overrides the hazard class.
 */
export async function classifyImageWithVertex(input: {
  imageBase64: string;
  mimeType?: string;
}): Promise<VertexClassifyResult> {
  const imageBase64 = input.imageBase64.trim();
  if (!imageBase64) {
    return emptyResult({
      source: "error",
      reason: "Empty image bytes.",
    });
  }

  const env = readVertexProject();
  if (!env) {
    return emptyResult({
      source: "skipped",
      reason: "Set VERTEX_PROJECT_ID (and ADC) to classify via Vertex.",
    });
  }

  const token = await getAccessToken();
  if (!token) {
    return emptyResult({
      source: "error",
      reason:
        "Could not obtain Google access token. Run gcloud auth application-default login or set GOOGLE_APPLICATION_CREDENTIALS.",
    });
  }

  // Run Gemini (class + place) and AutoML (class) together so submit is not
  // blocked on two back-to-back ~5s round trips.
  const geminiPromise = classifyWithVertexGemini({
    env,
    imageBase64,
    mimeType: input.mimeType,
    token,
  });
  const automlPromise = env.endpointId
    ? classifyWithAutomlEndpoint({
        env,
        imageBase64,
        token,
      })
    : Promise.resolve(null);

  const [gemini, automl] = await Promise.all([geminiPromise, automlPromise]);

  if (automl?.source === "automl" && automl.className) {
    return {
      ...gemini,
      className: automl.className,
      confidence: automl.confidence,
      displayNames: automl.displayNames,
      confidences: automl.confidences,
      source: "automl",
      endpoint: automl.endpoint,
      reason: gemini.locationLabel
        ? "AutoML hazard class · Vertex Gemini location."
        : automl.reason,
    };
  }

  return gemini;
}

/** Map claim + Vertex class / location into a short signal for Gemini / officers. */
export function formatVertexSignal(v: VertexClassifyResult): string {
  if (v.source === "skipped") {
    return `Vertex: skipped (${v.reason ?? "not configured"}).`;
  }
  if (v.source === "error" && !v.className) {
    return `Vertex: unavailable (${v.reason ?? "error"}).`;
  }
  if (!v.className || v.confidence == null) {
    return "Vertex: no prediction.";
  }
  const place =
    v.locationPlaceLabel ||
    v.locationLabel ||
    null;
  const placeBit = place
    ? ` location="${place}"${
        v.locationConfidence != null
          ? ` locConf=${v.locationConfidence.toFixed(2)}`
          : ""
      }`
    : "";
  if (v.source === "automl") {
    return `Vertex AutoML: class="${v.className}" confidence=${v.confidence.toFixed(2)}.${placeBit}`;
  }
  return `Vertex vision: class="${v.className}" confidence=${v.confidence.toFixed(2)}.${placeBit}`;
}
