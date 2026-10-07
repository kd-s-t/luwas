import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  ACCEPTED_ID_TYPES,
  type AcceptedIdType,
  type IdVerificationResult,
} from "@/lib/auth/idTypes";
import { runLocalIdVerify } from "@/lib/auth/localIdVerify";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from "@/lib/ai/geminiModels";

export const runtime = "nodejs";

type Body = {
  idType: AcceptedIdType;
  displayName: string;
  idImageBase64: string;
  idImageMime: string;
  faceImageBase64: string;
  faceImageMime: string;
  model?: string;
};

const ALLOWED = new Set<string>(ACCEPTED_ID_TYPES.map((t) => t.id));

function parseResult(text: string): Omit<
  IdVerificationResult,
  "source" | "model"
> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]) as {
      verified?: boolean;
      idType?: string;
      confidence?: number;
      extractedName?: string | null;
      reason?: string;
    };
    const idType =
      typeof parsed.idType === "string" && ALLOWED.has(parsed.idType)
        ? (parsed.idType as AcceptedIdType)
        : null;
    return {
      verified: Boolean(parsed.verified),
      idType,
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
      extractedName:
        parsed.extractedName != null ? String(parsed.extractedName) : null,
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

  const idType = ALLOWED.has(body.idType) ? body.idType : null;
  if (!idType) {
    return NextResponse.json(
      { error: "idType must be dl, passport, or umid" },
      { status: 400 },
    );
  }

  const displayName =
    typeof body.displayName === "string" ? body.displayName.trim() : "";
  const hasId = Boolean(body.idImageBase64);
  const hasFace = Boolean(body.faceImageBase64);

  const key = process.env.GEMINI_API_KEY;
  if (!key || !hasId || !hasFace) {
    return NextResponse.json(
      runLocalIdVerify({
        idType,
        displayName,
        hasIdImage: hasId,
        hasFaceImage: hasFace,
      }),
    );
  }

  const model = resolveGeminiModel(body.model ?? DEFAULT_GEMINI_MODEL);
  const prompt = `You are verifying Philippine government ID for Luwas barangay registration (anti-fraud).

Accepted ID types ONLY: Driver's License (dl), Passport (passport), UMID (umid).
Reject PhilPost ID, PhilID / National ID, school IDs, company IDs, or unclear documents.

You receive TWO images:
1) ID document photo
2) Live face selfie of the registrant

Return ONLY JSON:
{
  "verified": boolean,
  "idType": "dl" | "passport" | "umid" | null,
  "confidence": number 0-1,
  "extractedName": string | null,
  "reason": string
}

Rules:
- verified=true only if ID looks like an accepted type AND the selfie face reasonably matches the ID photo AND the claimed name is consistent with text on the ID when readable
- Claimed name on form: ${displayName || "(not provided)"}
- Claimed ID type: ${idType}
- If ID type mismatch, blurry, no face, or faces do not match → verified=false
- Be concise in reason. Not a life-safety or legal identity guarantee.`;

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
                mimeType: body.idImageMime || "image/jpeg",
                data: body.idImageBase64,
              },
            },
            {
              inlineData: {
                mimeType: body.faceImageMime || "image/jpeg",
                data: body.faceImageBase64,
              },
            },
          ],
        },
      ],
    });

    const parsed = parseResult(response.text ?? "");
    if (!parsed) {
      const local = runLocalIdVerify({
        idType,
        displayName,
        hasIdImage: hasId,
        hasFaceImage: hasFace,
      });
      return NextResponse.json({
        ...local,
        reason: `${local.reason} (Gemini parse fallback)`,
      } satisfies IdVerificationResult);
    }

    // Hard reject if model claims a non-accepted type
    if (parsed.verified && parsed.idType && !ALLOWED.has(parsed.idType)) {
      parsed.verified = false;
      parsed.reason = "ID type is not among accepted documents (DL, Passport, UMID).";
    }

    return NextResponse.json({
      ...parsed,
      source: "gemini",
      model,
    } satisfies IdVerificationResult);
  } catch {
    const local = runLocalIdVerify({
      idType,
      displayName,
      hasIdImage: hasId,
      hasFaceImage: hasFace,
    });
    return NextResponse.json({
      ...local,
      reason: `${local.reason} (Gemini unavailable)`,
    } satisfies IdVerificationResult);
  }
}
