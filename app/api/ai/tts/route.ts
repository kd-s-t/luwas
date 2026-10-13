import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ELEVENLABS_NARRATION_VOICE,
  ElevenLabsClient,
} from "@/lib/integrations/elevenlabs";
import {
  elevenVoiceSettings,
  inferSpeakEmotion,
  textWithEmotionDelivery,
  type SpeakEmotion,
} from "@/lib/speech/emotion";

export const runtime = "nodejs";

/** Process-local LRU — identical text+emotion never hits ElevenLabs twice. */
const MAX_CACHE = 80;
const audioCache = new Map<
  string,
  { bytes: Buffer; mimeType: string; voiceId: string; emotion: SpeakEmotion }
>();

function cacheKey(spoken: string, emotion: SpeakEmotion): string {
  return createHash("sha256")
    .update(emotion)
    .update("\n")
    .update(spoken)
    .digest("hex");
}

function cacheGet(key: string) {
  const hit = audioCache.get(key);
  if (!hit) return null;
  // refresh LRU order
  audioCache.delete(key);
  audioCache.set(key, hit);
  return hit;
}

function cacheSet(
  key: string,
  value: {
    bytes: Buffer;
    mimeType: string;
    voiceId: string;
    emotion: SpeakEmotion;
  },
) {
  if (audioCache.has(key)) audioCache.delete(key);
  audioCache.set(key, value);
  while (audioCache.size > MAX_CACHE) {
    const oldest = audioCache.keys().next().value;
    if (oldest == null) break;
    audioCache.delete(oldest);
  }
}

export async function GET() {
  const ready = ElevenLabsClient.isConfigured();
  return NextResponse.json({
    ready,
    provider: ready ? "elevenlabs" : "none",
    voiceId: process.env.ELEVENLABS_VOICE_ID?.trim() || ELEVENLABS_NARRATION_VOICE,
    cacheSize: audioCache.size,
  });
}

type Body = {
  text?: string;
  emotion?: SpeakEmotion;
};

export async function POST(req: Request) {
  if (!ElevenLabsClient.isConfigured()) {
    return NextResponse.json(
      { error: "ElevenLabs not configured (ELEVENLABS_API_KEY)." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.text === "string" ? body.text : "";
  if (!raw.trim()) {
    return NextResponse.json({ error: "Missing text" }, { status: 400 });
  }

  const emotion =
    body.emotion &&
    ["urgent", "serious", "warm", "encouraging", "calm"].includes(body.emotion)
      ? body.emotion
      : inferSpeakEmotion(raw);

  const spoken = textWithEmotionDelivery(raw, emotion);
  if (!spoken) {
    return NextResponse.json({ error: "Nothing to speak" }, { status: 400 });
  }

  const key = cacheKey(spoken, emotion);
  const cached = cacheGet(key);
  if (cached) {
    console.info("[api/ai/tts] cache hit", emotion);
    return new NextResponse(new Uint8Array(cached.bytes), {
      status: 200,
      headers: {
        "Content-Type": cached.mimeType,
        "Cache-Control": "no-store",
        "X-Luwas-TTS-Emotion": cached.emotion,
        "X-Luwas-TTS-Provider": "elevenlabs",
        "X-Luwas-TTS-Voice": cached.voiceId,
        "X-Luwas-TTS-Cache": "hit",
      },
    });
  }

  try {
    const client = ElevenLabsClient.fromEnv();
    const vs = elevenVoiceSettings(emotion);
    const audio = await client.generateSpeech({
      text: spoken,
      voiceSettings: {
        stability: vs.stability,
        similarityBoost: vs.similarity_boost,
        style: vs.style,
        useSpeakerBoost: vs.use_speaker_boost,
      },
    });

    cacheSet(key, {
      bytes: audio.bytes,
      mimeType: audio.mimeType,
      voiceId: audio.voiceId,
      emotion,
    });
    console.info("[api/ai/tts] cache miss → elevenlabs", emotion);

    return new NextResponse(new Uint8Array(audio.bytes), {
      status: 200,
      headers: {
        "Content-Type": audio.mimeType,
        "Cache-Control": "no-store",
        "X-Luwas-TTS-Emotion": emotion,
        "X-Luwas-TTS-Provider": "elevenlabs",
        "X-Luwas-TTS-Voice": audio.voiceId,
        "X-Luwas-TTS-Cache": "miss",
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message.slice(0, 240) : "ElevenLabs failed";
    console.error("[api/ai/tts]", message);
    return NextResponse.json({ error: message, emotion }, { status: 502 });
  }
}
