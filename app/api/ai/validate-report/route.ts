import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from "@/lib/ai/geminiModels";
import { runLocalValidate } from "@/lib/reports/localValidate";
import type { ReportHazardHint, ReportMediaType } from "@/lib/reports/types";

export const runtime = "nodejs";

type Body = {
  title: string;
  notes: string;
  hazardHint: ReportHazardHint;
  mediaType: ReportMediaType;
  mediaMime: string;
  /** Base64 without data: prefix — preferred for emulator Storage. */
  mediaBase64?: string;
  fileName?: string;
  model?: string;
};

type ValidateResponse = {
  verdict: "legit" | "rejected" | "needs_review";
  confidence: number;
  reason: string;
  source: "gemini" | "local";
  model?: string;
  status: "legit" | "rejected" | "needs_review";
};

function parseVerdict(text: string): Omit<ValidateResponse, "source" | "model" | "status"> | null {
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

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const notes = typeof body.notes === "string" ? body.notes.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const mediaType = body.mediaType === "video" ? "video" : "photo";
  const hazardHint = body.hazardHint ?? "other";
  const mediaMime =
    body.mediaMime ||
    (mediaType === "video" ? "video/mp4" : "image/jpeg");

  const key = process.env.GEMINI_API_KEY;
  if (!key || !body.mediaBase64) {
    const local = runLocalValidate({
      title,
      notes,
      hazardHint,
      mediaType,
      mediaMime,
      fileName: body.fileName,
    });
    const payload: ValidateResponse = {
      ...local,
      status: local.verdict,
      reason: body.mediaBase64
        ? local.reason
        : `${local.reason} (no media bytes — text heuristics only)`,
    };
    return NextResponse.json(payload);
  }

  const model = resolveGeminiModel(body.model ?? DEFAULT_GEMINI_MODEL);
  const prompt = `You are Mangluluwas, validating a citizen hazard field report for Brgy. Nangka, Consolacion, Cebu.
Decide if the media + text look like a genuine on-the-ground hazard report (not spam, meme, unrelated content, or obvious fake).

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
Guidance for responders — not a life-safety guarantee.

Hazard hint: ${hazardHint}
Title: ${title}
Notes: ${notes}
Media type: ${mediaType}`;

  try {
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mediaMime,
                data: body.mediaBase64,
              },
            },
          ],
        },
      ],
    });

    const parsed = parseVerdict(response.text ?? "");
    if (!parsed) {
      const local = runLocalValidate({
        title,
        notes,
        hazardHint,
        mediaType,
        mediaMime,
        fileName: body.fileName,
      });
      return NextResponse.json({
        ...local,
        status: local.verdict,
        reason: `${local.reason} (Gemini parse fallback)`,
      } satisfies ValidateResponse);
    }

    return NextResponse.json({
      ...parsed,
      source: "gemini",
      model,
      status: parsed.verdict,
    } satisfies ValidateResponse);
  } catch {
    const local = runLocalValidate({
      title,
      notes,
      hazardHint,
      mediaType,
      mediaMime,
      fileName: body.fileName,
    });
    return NextResponse.json({
      ...local,
      status: local.verdict,
      reason: `${local.reason} (Gemini unavailable — local queue rules used.)`,
    } satisfies ValidateResponse);
  }
}
