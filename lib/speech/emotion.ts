export type SpeakEmotion =
  | "urgent"
  | "serious"
  | "warm"
  | "encouraging"
  | "calm";

/** Infer delivery emotion from Mangluluwas reply text. */
export function inferSpeakEmotion(raw: string): SpeakEmotion {
  const t = raw.toLowerCase();
  if (
    /evacuat|immediate|urgent|rescue|stranded|roof|fire|sunog|drowning|sos|now\b|life.?threat|dispatch/.test(
      t,
    )
  ) {
    return "urgent";
  }
  if (
    /crime|police|pnp|accident|hospital|fatal|injured|warning|hazard|landslide/.test(
      t,
    )
  ) {
    return "serious";
  }
  if (
    /good (news|job)|well done|kumusta|welcome|salamat|glad|safe|monitor|prepare/.test(
      t,
    )
  ) {
    return "warm";
  }
  if (/triage|stand by|ready|can help|let'?s|next step|i'?ll/.test(t)) {
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
 * Light spoken delivery cue (natural English) so the model leans emotional
 * without dumping a stage direction the officer hears as a label.
 */
function cleanForSpeech(raw: string): string {
  return raw
    .replace(/\s*\(Gemini[^)]*\)\s*/gi, " ")
    .replace(/\s*\(local[^)]*\)\s*/gi, " ")
    .replace(/[·•]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function textWithEmotionDelivery(
  raw: string,
  emotion: SpeakEmotion,
): string {
  const text = cleanForSpeech(raw);
  if (!text) return "";
  // Cap length for latency / ElevenLabs limits.
  const clipped =
    text.length > 2200 ? `${text.slice(0, 2200).trim()}…` : text;

  switch (emotion) {
    case "urgent":
      return `Speaking with urgency and concern. ${clipped}`;
    case "serious":
      return `Speaking firmly and clearly. ${clipped}`;
    case "warm":
      return `Speaking warmly and calmly. ${clipped}`;
    case "encouraging":
      return `Speaking with steady encouragement. ${clipped}`;
    case "calm":
    default:
      return clipped;
  }
}
