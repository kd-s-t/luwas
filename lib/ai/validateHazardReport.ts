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
import {
  localPriorityForReport,
  parsePriorityFactors,
  parseReportPriority,
} from "@/lib/reports/priority";
import {
  inferHazard,
  parseHazardHint,
} from "@/lib/reports/inferHazard";
import type {
  ReportHazardHint,
  ReportMediaType,
  ReportPriority,
  ReportPriorityFactors,
} from "@/lib/reports/types";

export type HazardValidateResult = {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
  source: "gemini" | "local";
  model: string | null;
  status: "legit" | "rejected" | "needs_review";
  /** Hazard type detected from media / voice / text (may correct citizen hint). */
  hazardHint: ReportHazardHint;
  priority: ReportPriority;
  priorityFactors: ReportPriorityFactors;
  vertexClass: string | null;
  vertexConfidence: number | null;
  vertexSource: VertexClassifyResult["source"];
};

function parseVerdict(text: string): {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
  hazardHint: ReportHazardHint | null;
  priority: ReportPriority | null;
  priorityFactors: ReportPriorityFactors | null;
} | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      verdict?: string;
      confidence?: number;
      reason?: string;
      hazardHint?: string;
      priority?: string;
      priorityFactors?: unknown;
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
      hazardHint: parseHazardHint(parsed.hazardHint),
      priority: parseReportPriority(parsed.priority),
      priorityFactors: parsePriorityFactors(parsed.priorityFactors),
    };
  } catch {
    return null;
  }
}

function resolveHazardHint(input: {
  claimed: ReportHazardHint;
  fromModel: ReportHazardHint | null;
  vertexClass: string | null;
  title: string;
  notes: string;
  voiceTranscript: string;
  reason: string;
}): ReportHazardHint {
  if (input.fromModel && input.fromModel !== "other") return input.fromModel;
  const fromVertex = parseHazardHint(input.vertexClass);
  if (fromVertex && fromVertex !== "other") return fromVertex;
  const inferred = inferHazard(
    input.title,
    input.notes,
    input.voiceTranscript,
    input.reason,
  );
  if (inferred !== "other") return inferred;
  if (input.fromModel) return input.fromModel;
  return input.claimed || "other";
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
  voiceTranscript?: string;
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
  const reason = `${local.reason} ${input.extraReason} ${formatVertexSignal(input.vertex)}`.trim();
  const detected = resolveHazardHint({
    claimed: input.hazardHint,
    fromModel: null,
    vertexClass: input.vertex.className,
    title: input.title,
    notes: input.notes,
    voiceTranscript: input.voiceTranscript ?? "",
    reason,
  });
  const ranked = localPriorityForReport({
    title: input.title,
    notes: input.notes,
    hazardHint: detected,
    verdict,
  });
  return withVertex(
    {
      ...local,
      verdict,
      status: verdict,
      model: null,
      hazardHint: detected,
      priority: ranked.priority,
      priorityFactors: ranked.factors,
      reason,
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
  /** Speech-to-text of an attached voice note (voice-only reports). */
  voiceTranscript?: string;
  fileName?: string;
  model?: string;
}): Promise<HazardValidateResult> {
  const title = input.title.trim();
  const voiceTranscript = input.voiceTranscript?.trim() || "";
  const notes = [input.notes.trim(), voiceTranscript ? `Voice transcript: ${voiceTranscript}` : ""]
    .filter(Boolean)
    .join("\n");
  const mediaType = input.mediaType === "video" ? "video" : "photo";
  const hazardHint = input.hazardHint ?? "other";
  const mediaMime =
    input.mediaMime ||
    (mediaType === "video" ? "video/mp4" : "image/jpeg");
  const mediaBase64 = input.mediaBase64?.trim() || undefined;
  const voiceOnly = !mediaBase64 && Boolean(voiceTranscript);

  const localE2e =
    process.env.NEXT_PUBLIC_USE_EMULATORS === "true" ||
    process.env.UGNAI_E2E_ACCEPT_REPORTS === "true";

  const vertex =
    mediaType === "photo" && mediaBase64
      ? await classifyImageWithVertex({
          imageBase64: mediaBase64,
          mimeType: mediaMime,
        })
      : ({
          className: null,
          confidence: null,
          displayNames: [],
          confidences: [],
          source: "skipped" as const,
          reason: "Image class needs photo bytes (inline base64).",
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
      voiceTranscript,
    });
  }

  const model = resolveGeminiModel(input.model ?? DEFAULT_GEMINI_MODEL);
  const vertexLine = formatVertexSignal(vertex);
  const evidenceKind = mediaBase64
    ? "media + text"
    : voiceOnly
      ? "voice transcript + text"
      : "text";
  const prompt = `You are Mangugnai, validating a citizen hazard field report for Brgy. Nangka, Consolacion, Cebu.
Decide if the ${evidenceKind} look like a genuine on-the-ground hazard report (not spam, meme, unrelated content, or obvious fake).

A separate Vertex AI image classifier already scored the photo. Use that as a signal, not the only rule:
${vertexLine}

Return ONLY JSON:
{
  "verdict": "legit" | "rejected" | "needs_review",
  "confidence": number between 0 and 1,
  "reason": string,
  "hazardHint": "flood" | "landslide" | "typhoon" | "fire" | "crime" | "accident" | "blockage" | "evac" | "other",
  "priority": "critical" | "high" | "medium" | "low",
  "priorityFactors": {
    "immediateSeverity": string,
    "peopleAffected": string,
    "existingCoverage": string,
    "deliveryFeasibility": string,
    "evidenceQuality": string
  }
}

Rules:
- legit: clear evidence of flood/landslide/storm/fire/damage matching the claim
- rejected: spam, joke, unrelated, stock meme, or clearly fabricated
- needs_review: unclear, low quality, or mismatch between text and media
- hazardHint: the actual hazard visible/heard in the evidence. If the citizen hint is "other" but the photo or voice clearly shows fire (or flood, etc.), set hazardHint to that type — do not keep "other"
- If Vertex class is "unrelated" (or equivalent) with high confidence, prefer rejected or needs_review
- If Vertex class mismatches the hazard claim (e.g. beach vs flood), prefer needs_review
- If Vertex and claim agree with high confidence, lean legit
- Voice-only is valid: if the transcript clearly describes an on-the-ground hazard, prefer legit or needs_review (not rejected solely for missing a photo)
${
  localE2e
    ? `- LOCAL DEMO / E2E: accept flood/storm/hazard imagery even if it looks like a stock photo or has a watermark — officers are testing the flow with sample media. Prefer legit over rejected when the scene matches the hazard claim.`
    : ""
}
${mediaBase64 ? "" : voiceOnly ? "- No photo bytes; judge from voice transcript + notes + hazard hint." : "- No photo bytes were provided; judge from text and hazard hint only, prefer needs_review when unsure."}

Priority (you decide for responders / resource allocation):
- Score using these factors only:
  1. Immediate severity — verified life-safety or health risk?
  2. People affected — how many need the resource, and for how long?
  3. Existing coverage — how much usable stock the community likely has (infer; say unknown if unclear)
  4. Delivery feasibility — can supplies physically reach the location?
  5. Evidence quality — verified, estimated, or conflicting?
- critical: life-safety now and/or many people with poor access or weak coverage
- high: urgent need, clear impact, feasible response
- medium: real need but limited scale or incomplete evidence
- low: minor, rejected, or insufficient signal
- Each priorityFactors value: one short sentence (max ~120 chars)

Hazard hint: ${hazardHint}
Title: ${title}
Notes: ${notes}
Media type: ${mediaType}${voiceOnly ? " (voice-only report)" : ""}`;

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
        voiceTranscript,
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

    const reason =
      verdict !== parsed.verdict
        ? `Local e2e · accepted for demo. ${parsed.reason}`
        : parsed.reason;
    const detected = resolveHazardHint({
      claimed: hazardHint,
      fromModel: parsed.hazardHint,
      vertexClass: vertex.className,
      title,
      notes,
      voiceTranscript,
      reason,
    });

    const fallbackRank = localPriorityForReport({
      title,
      notes,
      hazardHint: detected,
      verdict,
    });
    const priority = parsed.priority ?? fallbackRank.priority;
    const priorityFactors = parsed.priorityFactors ?? fallbackRank.factors;

    return withVertex(
      {
        verdict,
        confidence: parsed.confidence,
        source: "gemini",
        model,
        status: verdict,
        hazardHint: detected,
        priority,
        priorityFactors,
        reason,
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
      voiceTranscript,
    });
  }
}
