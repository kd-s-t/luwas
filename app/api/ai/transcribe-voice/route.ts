import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  DEFAULT_GEMINI_MODEL,
  resolveGeminiModel,
} from "@/lib/ai/geminiModels";

export const runtime = "nodejs";

type Body = {
  voiceBase64?: string;
  voiceMime?: string;
  languageHint?: string;
  model?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const voiceBase64 =
    typeof body.voiceBase64 === "string" ? body.voiceBase64.trim() : "";
  if (!voiceBase64) {
    return NextResponse.json({ error: "voiceBase64 required" }, { status: 400 });
  }

  const voiceMime =
    typeof body.voiceMime === "string" && body.voiceMime.trim()
      ? body.voiceMime.trim().split(";")[0]!
      : "audio/webm";
  const languageHint =
    typeof body.languageHint === "string" && body.languageHint.trim()
      ? body.languageHint.trim()
      : "en, Filipino, or Cebuano";

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json({
      transcript: "",
      source: "local",
      reason: "GEMINI_API_KEY not set — transcript skipped.",
    });
  }

  const model = resolveGeminiModel(body.model ?? DEFAULT_GEMINI_MODEL);
  const prompt = `Transcribe this citizen emergency voice note from the Philippines.
Languages may include ${languageHint}.
Return ONLY the spoken words as plain text (no quotes, no JSON, no commentary).
If the audio is silence, music, or unintelligible, return exactly: [inaudible]`;

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
                mimeType: voiceMime,
                data: voiceBase64,
              },
            },
          ],
        },
      ],
    });

    const transcript = (response.text ?? "")
      .trim()
      .replace(/^["']|["']$/g, "");
    return NextResponse.json({
      transcript: transcript || "[inaudible]",
      source: "gemini",
      model,
    });
  } catch (err) {
    console.error("[transcribe-voice] Gemini failed", err);
    return NextResponse.json({
      transcript: "",
      source: "local",
      reason: "Transcription unavailable.",
    });
  }
}
