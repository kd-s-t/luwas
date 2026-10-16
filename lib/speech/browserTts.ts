/** Browser Web Speech API only — no cloud TTS. */

const VOICE_MUTE_KEY = "ugnai.mangugnai.ttsMute";
const VOICE_URI_KEY = "ugnai.mangugnai.ttsVoiceUri";

export type TtsVoiceOption = {
  voiceURI: string;
  name: string;
  lang: string;
  localService: boolean;
  label: string;
};

export function isBrowserTtsAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.speechSynthesis !== "undefined" &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function readTtsMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(VOICE_MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeTtsMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VOICE_MUTE_KEY, muted ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function readTtsVoiceUri(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(VOICE_URI_KEY);
  } catch {
    return null;
  }
}

export function writeTtsVoiceUri(voiceURI: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!voiceURI) window.localStorage.removeItem(VOICE_URI_KEY);
    else window.localStorage.setItem(VOICE_URI_KEY, voiceURI);
  } catch {
    /* ignore */
  }
}

/** Strip noise that sounds bad when spoken aloud. */
export function textForSpeech(raw: string): string {
  return raw
    .replace(/\s*\(Gemini[^)]*\)\s*/gi, " ")
    .replace(/\s*\(local[^)]*\)\s*/gi, " ")
    .replace(/[·•]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function scoreVoice(v: SpeechSynthesisVoice): number {
  let s = 0;
  const name = v.name;
  const lang = v.lang;
  if (/en-PH/i.test(lang)) s += 50;
  else if (/en-US/i.test(lang)) s += 40;
  else if (/en-GB/i.test(lang)) s += 35;
  else if (/^en/i.test(lang)) s += 25;
  else s -= 20;

  // Prefer local OS voices (Mac Samantha, Windows Natural, etc.).
  if (v.localService) s += 40;
  else s -= 25;

  // Strong picks for UGNAI (local when available).
  if (/^(Samantha|Karen|Moira|Tessa|Daniel|Alex|Fred|Victoria)\b/i.test(name)) {
    s += 45;
  }
  if (/Microsoft (Aria|Jenny|Guy|Michelle|Andrew).*Natural/i.test(name)) {
    s += 40;
  }
  if (/enhanced|premium|natural|neural/i.test(name)) s += 15;

  // Chrome "Google US English · network" is a common weird default — push down.
  if (/^Google US English$/i.test(name) && !v.localService) s -= 50;
  if (/^Google UK English/i.test(name) && !v.localService) s -= 35;
  if (/Google/i.test(name) && !v.localService) s -= 15;

  // Novelty / comic system voices.
  if (
    /Zarvox|Trinoids|Whisper|Bad News|Good News|Bubbles|Boing|Jester|Organ|Cellos|Bells|Pipe Organ/i.test(
      name,
    )
  ) {
    s -= 60;
  }
  return s;
}

/** True for the Chrome network voice that often becomes a bad auto-default. */
export function isWeakDefaultVoice(v: {
  name: string;
  localService: boolean;
}): boolean {
  return (
    !v.localService &&
    (/^Google US English$/i.test(v.name) || /^Google UK English/i.test(v.name))
  );
}

export function pickDefaultTtsVoiceUri(
  voices: TtsVoiceOption[],
): string | null {
  return voices[0]?.voiceURI ?? null;
}

export function listTtsVoices(): TtsVoiceOption[] {
  if (!isBrowserTtsAvailable()) return [];
  const voices = window.speechSynthesis.getVoices();
  const ranked = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return ranked.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    localService: v.localService,
    label: `${v.name} (${v.lang})${v.localService ? "" : " · network"}`,
  }));
}

function resolveVoice(preferredUri: string | null): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  if (preferredUri) {
    const hit = voices.find((v) => v.voiceURI === preferredUri);
    if (hit) return hit;
  }
  return [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a))[0] ?? null;
}

/** Speak text with the chosen (or best English) system voice. */
export function speakText(raw: string, voiceURI?: string | null): boolean {
  if (!isBrowserTtsAvailable()) return false;
  const text = textForSpeech(raw);
  if (!text) return false;

  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1;
  utter.pitch = 1;
  const voice = resolveVoice(
    voiceURI === undefined ? readTtsVoiceUri() : voiceURI,
  );
  if (voice) {
    utter.voice = voice;
    utter.lang = voice.lang;
  } else {
    utter.lang = "en-US";
  }
  window.speechSynthesis.speak(utter);
  return true;
}

export function stopSpeaking(): void {
  if (!isBrowserTtsAvailable()) return;
  window.speechSynthesis.cancel();
}

/**
 * Load voices (Chrome loads them async). Resolves when the list is ready.
 */
export function warmSpeechVoices(): Promise<TtsVoiceOption[]> {
  if (!isBrowserTtsAvailable()) return Promise.resolve([]);
  const current = listTtsVoices();
  if (current.length) return Promise.resolve(current);
  return new Promise((resolve) => {
    const finish = () => resolve(listTtsVoices());
    window.speechSynthesis.addEventListener("voiceschanged", finish, {
      once: true,
    });
    void window.speechSynthesis.getVoices();
    window.setTimeout(finish, 800);
  });
}
