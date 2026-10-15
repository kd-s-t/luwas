import { GoogleGenAI } from "@google/genai";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from "@/lib/ai/geminiModels";
import {
  classifyImageWithVertex,
  formatVertexSignal,
  type VertexClassifyResult,
} from "@/lib/ai/vertexClassify";
import { runLocalValidate } from "@/lib/reports/localValidate";
import type { ReportHazardHint, ReportMediaType } from "@/lib/reports/types";

export type HazardValidateResult = {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
  source: "gemini" | "local";
  model: string | null;
  status: "legit" | "rejected" | "needs_review";
  vertexClass: string | null;
  vertexConfidence: number | null;
  vertexSource: VertexClassifyResult["source"];
};

function parseVerdict(text: string): {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
} | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      verdict?: string;
      confidence?: number;
      reason?: string;
    };
    const verdict =
      parsed.verdict === "legit" ||
      parsed.verdict === "rejected" ||
      parsed.verdict === "needs_review"
        ? parsed.verdict
        : null;
    if (!verdict) return null;
    const confidence = Math.max(
      0,
      Math.min(1, Number(parsed.confidence ?? 0.5)),
    );
    return {
      verdict,
      confidence,
      reason: String(parsed.reason ?? "No reason provided."),
    };
  } catch {
    return null;
  }
}

function withVertex(
  payload: Omit<
    HazardValidateResult,
    "vertexClass" | "vertexConfidence" | "vertexSource"
  >,
  vertex: VertexClassifyResult,
): HazardValidateResult {
  return {
    ...payload,
    vertexClass: vertex.className,
    vertexConfidence: vertex.confidence,
    vertexSource: vertex.source,
  };
}

function localFallback(input: {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaMime: string;
  fileName?: string;
  localE2e: boolean;
  extraReason: string;
  vertex: VertexClassifyResult;
}): HazardValidateResult {
  const local = runLocalValidate({
    title: input.title,
    notes: input.notes,
    hazardHint: input.hazardHint,
    mediaType: input.mediaType,
    mediaMime: input.mediaMime,
    fileName: input.fileName,
  });
  const verdict =
    input.localE2e && local.verdict === "rejected" ? "legit" : local.verdict;
  const vertexLine = formatVertexSignal(input.vertex);
  return withVertex(
    {
      ...local,
      verdict,
      status: verdict,
      model: null,
      reason: `${local.reason} ${input.extraReason} ${vertexLine}`.trim(),
    },
    input.vertex,
  );
}

/** Gemini first when GEMINI_API_KEY is set; local rules only as fallback. */
export async function validateHazardReport(input: {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaMime: string;
  mediaBase64?: string;
  fileName?: string;
  model?: string;
}): Promise<HazardValidateResult> {
  const title = input.title.trim();
  const notes = input.notes.trim();
  const mediaType = input.mediaType === "video" ? "video" : "photo";
  const hazardHint = input.hazardHint ?? "other";
  const mediaMime =
    input.mediaMime ||
    (mediaType === "video" ? "video/mp4" : "image/jpeg");
  const mediaBase64 = input.mediaBase64?.trim() || undefined;

  const localE2e =
    process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
    process.env.LUWAS_E2E_ACCEPT_REPORTS === "true";

  const vertex =
    mediaType === "photo" && mediaBase64
      ? await classifyImageWithVertex({ imageBase64: mediaBase64 })
      : ({
          className: null,
          confidence: null,
          displayNames: [],
          confidences: [],
          source: "skipped" as const,
          reason: "Vertex runs on photo bytes only.",
        } satisfies VertexClassifyResult);

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return localFallback({
      title,
      notes,
      hazardHint,
      mediaType,
      mediaMime,
      fileName: input.fileName,
      localE2e,
      extraReason: mediaBase64
        ? ""
        : "(no media bytes — text heuristics only)",
      vertex,
    });
  }

  const model = resolveGeminiModel(input.model ?? DEFAULT_GEMINI_MODEL);
  const vertexLine = formatVertexSignal(vertex);
  const prompt = `You are Mangluluwas, validating a citizen hazard field report for Brgy. Nangka, Consolacion, Cebu.
Decide if the ${mediaBase64 ? "media + text" : "text"} look like a genuine on-the-ground hazard report (not spam, meme, unrelated content, or obvious fake).

A separate Vertex AI image classifier already scored the photo. Use that as a signal, not the only rule:
${vertexLine}

Return ONLY JSON:
{
  "verdict": "legit" | "rejected" | "needs_review",
  "confidence": number between 0 and 1,
  "reason": string
}

Rules:
- legit: clear evidence of flood/landslide/storm/fire/damage matching the claim
- rejected: spam, joke, unrelated, stock meme, or clearly fabricated
- needs_review: unclear, low quality, or mismatch between text and media
- If Vertex class is "unrelated" (or equivalent) with high confidence, prefer rejected or needs_review
- If Vertex class mismatches the hazard claim (e.g. beach vs flood), prefer needs_review
- If Vertex and claim agree with high confidence, lean legit
${
  localE2e
    ? `- LOCAL DEMO / E2E: accept flood/storm/hazard imagery even if it looks like a stock photo or has a watermark — officers are testing the flow with sample media. Prefer legit over rejected when the scene matches the hazard claim.`
    : ""
}
${mediaBase64 ? "" : "- No photo bytes were provided; judge from text and hazard hint only, prefer needs_review when unsure."}
Guidance for responders.

Hazard hint: ${hazardHint}
Title: ${title}
Notes: ${notes}
Media type: ${mediaType}`;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [{ text: prompt }];
    if (mediaBase64) {
      parts.push({
        inlineData: {
          mimeType: mediaMime,
          data: mediaBase64,
        },
      });
    }

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts }],
    });

    const parsed = parseVerdict(response.text ?? "");
    if (!parsed) {
      return localFallback({
        title,
        notes,
        hazardHint,
        mediaType,
        mediaMime,
        fileName: input.fileName,
        localE2e,
        extraReason: "(Gemini parse fallback)",
        vertex,
      });
    }

    const stocky =
      /stock|watermark|shutterstock|getty|fabricated|generic/i.test(
        parsed.reason,
      );
    const verdict =
      localE2e && parsed.verdict === "rejected" && stocky
        ? "legit"
        : parsed.verdict;

    return withVertex(
      {
        ...parsed,
        verdict,
        source: "gemini",
        model,
        status: verdict,
        reason:
          verdict !== parsed.verdict
            ? `Local e2e · accepted for demo. ${parsed.reason}`
            : parsed.reason,
      },
      vertex,
    );
  } catch {
    return localFallback({
      title,
      notes,
      hazardHint,
      mediaType,
      mediaMime,
      fileName: input.fileName,
      localE2e,
      extraReason: "(Gemini unavailable — local queue rules used.)",
      vertex,
    });
  }
}
