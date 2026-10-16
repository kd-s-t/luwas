export type SpeakEmotion =
  | "urgent"
  | "serious"
  | "warm"
  | "encouraging"
  | "calm";

/** Infer delivery emotion from Mangugnai reply text. */
export function inferSpeakEmotion(raw: string): SpeakEmotion {
  const t = raw.toLowerCase();
  if (
    /\b(evacuat\w*|immediate|urgent|rescue|stranded|roof|fire|sunog|drowning|sos|life[\s-]?threat|dispatch)\b/.test(
      t,
    )
  ) {
    return "urgent";
  }
  if (
    /\b(crime|police|pnp|accident|hospital|fatal|injured|landslide)\b/.test(t)
  ) {
    return "serious";
  }
  if (
    /\b(good (news|job)|well done|kumusta|welcome|salamat|glad)\b/.test(t)
  ) {
    return "warm";
  }
  if (
    /\b(run triage|stand by|next step|can help)\b/.test(t)
  ) {
    return "encouraging";
  }
  return "calm";
}

/** ElevenLabs voice_settings tuned per emotion (multilingual v2 / chapter-studio model). */
export function elevenVoiceSettings(emotion: SpeakEmotion): {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
} {
  switch (emotion) {
    case "urgent":
      return {
        stability: 0.22,
        similarity_boost: 0.78,
        style: 0.72,
        use_speaker_boost: true,
      };
    case "serious":
      return {
        stability: 0.45,
        similarity_boost: 0.85,
        style: 0.4,
        use_speaker_boost: true,
      };
    case "warm":
      return {
        stability: 0.38,
        similarity_boost: 0.8,
        style: 0.55,
        use_speaker_boost: true,
      };
    case "encouraging":
      return {
        stability: 0.32,
        similarity_boost: 0.8,
        style: 0.58,
        use_speaker_boost: true,
      };
    case "calm":
    default:
      return {
        stability: 0.52,
        similarity_boost: 0.82,
        style: 0.25,
        use_speaker_boost: true,
      };
  }
}

/**
 * Clean reply text for TTS. Emotion is applied via ElevenLabs voice_settings only —
 * never prepend stage directions (those were being read aloud as the first words).
 */
function cleanForSpeech(raw: string): string {
  return raw
    .replace(/\s*\(Gemini[^)]*\)\s*/gi, " ")
    .replace(/\s*\(local[^)]*\)\s*/gi, " ")
    .replace(
      /^\s*speaking with (urgency and concern|firmly and clearly|warmly and calmly|steady encouragement)\.\s*/i,
      "",
    )
    .replace(/[·•]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

/** Spoken script for ElevenLabs — reply text only; `emotion` kept for API callers. */
export function textWithEmotionDelivery(
  raw: string,
  _emotion: SpeakEmotion,
): string {
  const text = cleanForSpeech(raw);
  if (!text) return "";
  return text.length > 2200 ? `${text.slice(0, 2200).trim()}…` : text;
}
