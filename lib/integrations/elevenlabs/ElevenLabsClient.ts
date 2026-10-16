/**
 * Slim ElevenLabs client aligned with chapter-studio
 * (`src/integrations/elevenlabs/ElevenLabsClient.ts`) — TTS only for Ugnai.
 */

import { ElevenLabsClient as ElevenLabsSdk } from "@elevenlabs/elevenlabs-js";
import {
  ELEVENLABS_DEFAULT_TTS_MODEL,
  ELEVENLABS_ENV_KEY,
  ELEVENLABS_FREE_FALLBACK_VOICE,
  ELEVENLABS_NARRATION_VOICE,
} from "@/lib/integrations/elevenlabs/constants";
import { streamToBuffer } from "@/lib/integrations/elevenlabs/stream-to-buffer";

export type ElevenLabsVoiceSettings = {
  stability: number;
  similarityBoost: number;
  style?: number;
  useSpeakerBoost?: boolean;
};

export type ElevenLabsTtsParams = {
  text: string;
  voiceId?: string;
  modelId?: string;
  voiceSettings?: ElevenLabsVoiceSettings;
};

export type GeneratedElevenLabsAudio = {
  bytes: Buffer;
  mimeType: string;
  voiceId: string;
};

function isLibraryVoiceBlocked(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return (
    lower.includes("paid_plan_required") ||
    lower.includes("library voices") ||
    lower.includes("payment_required") ||
    lower.includes("free users cannot use library")
  );
}

export class ElevenLabsClient {
  private readonly sdk: ElevenLabsSdk;

  constructor(apiKey: string) {
    if (!apiKey.trim()) {
      throw new Error(`${ELEVENLABS_ENV_KEY} is not configured`);
    }
    this.sdk = new ElevenLabsSdk({ apiKey });
  }

  static fromEnv(): ElevenLabsClient {
    const key = process.env[ELEVENLABS_ENV_KEY];
    if (!key?.trim()) {
      throw new Error(`${ELEVENLABS_ENV_KEY} is not configured`);
    }
    return new ElevenLabsClient(key.trim().replace(/^["']|["']$/g, ""));
  }

  static isConfigured(): boolean {
    return Boolean(process.env[ELEVENLABS_ENV_KEY]?.trim());
  }

  private async convertOnce(
    voiceId: string,
    modelId: string,
    text: string,
    voiceSettings?: ElevenLabsVoiceSettings,
  ): Promise<GeneratedElevenLabsAudio> {
    const stream = await this.sdk.textToSpeech.convert(voiceId, {
      text,
      modelId,
      ...(voiceSettings
        ? {
            voiceSettings: {
              stability: voiceSettings.stability,
              similarityBoost: voiceSettings.similarityBoost,
              style: voiceSettings.style,
              useSpeakerBoost: voiceSettings.useSpeakerBoost,
            },
          }
        : {}),
    });
    const bytes = await streamToBuffer(stream);
    return { bytes, mimeType: "audio/mpeg", voiceId };
  }

  async generateSpeech(
    params: ElevenLabsTtsParams,
  ): Promise<GeneratedElevenLabsAudio> {
    const text = params.text.trim();
    if (!text) throw new Error("Script text is required");

    const preferred =
      params.voiceId?.trim() ||
      process.env.ELEVENLABS_VOICE_ID?.trim() ||
      ELEVENLABS_NARRATION_VOICE;
    const modelId =
      params.modelId?.trim() ||
      process.env.ELEVENLABS_MODEL_ID?.trim() ||
      ELEVENLABS_DEFAULT_TTS_MODEL;

    try {
      return await this.convertOnce(
        preferred,
        modelId,
        text,
        params.voiceSettings,
      );
    } catch (err) {
      if (
        isLibraryVoiceBlocked(err) &&
        preferred !== ELEVENLABS_FREE_FALLBACK_VOICE
      ) {
        console.warn(
          "[elevenlabs]",
          preferred,
          "blocked on free plan →",
          ELEVENLABS_FREE_FALLBACK_VOICE,
          "(George)",
        );
        return await this.convertOnce(
          ELEVENLABS_FREE_FALLBACK_VOICE,
          modelId,
          text,
          params.voiceSettings,
        );
      }
      throw err;
    }
  }
}
