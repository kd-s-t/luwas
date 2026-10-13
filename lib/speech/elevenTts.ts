"use client";

import {
  isBrowserTtsAvailable,
  speakText as speakBrowser,
  stopSpeaking as stopBrowser,
} from "@/lib/speech/browserTts";
import {
  inferSpeakEmotion,
  type SpeakEmotion,
} from "@/lib/speech/emotion";

let audioEl: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let elevenReadyCache: boolean | null = null;
/** After quota / auth failure, skip ElevenLabs briefly. */
let elevenCooldownUntil = 0;
/** Bumps on every speak / stop so in-flight fetches never stack audio. */
let speakGen = 0;
let speaking = false;
const speakingListeners = new Set<(active: boolean) => void>();
/** In-memory ElevenLabs blobs by message id — replay must never re-call the API. */
const blobByMessageId = new Map<string, Blob>();
/** Same bytes keyed by emotion+text — survives message-id mismatches. */
const blobByContentKey = new Map<string, Blob>();
/** One in-flight ElevenLabs fetch per message / content key. */
const inflightByKey = new Map<string, Promise<Blob | null>>();

const AUDIO_URL_STORE = "luwas.tts.audioUrls.v1";

export function ttsContentKey(raw: string, emotion: SpeakEmotion): string {
  return `${emotion}\n${raw.trim()}`;
}

export function rememberTtsBlob(messageId: string, blob: Blob): void {
  const id = messageId.trim();
  if (!id || blob.size === 0) return;
  blobByMessageId.set(id, blob);
}

export function rememberTtsBlobForContent(
  raw: string,
  emotion: SpeakEmotion,
  blob: Blob,
): void {
  if (blob.size === 0) return;
  blobByContentKey.set(ttsContentKey(raw, emotion), blob);
}

export function getCachedTtsBlob(messageId: string): Blob | undefined {
  return blobByMessageId.get(messageId.trim());
}

export function rememberAudioUrl(messageId: string, audioUrl: string): void {
  const id = messageId.trim();
  const url = audioUrl.trim();
  if (!id || !url || typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(AUDIO_URL_STORE);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[id] = url;
    window.sessionStorage.setItem(AUDIO_URL_STORE, JSON.stringify(map));
  } catch {
    /* quota / private mode */
  }
}

export function recallAudioUrl(messageId: string): string | null {
  const id = messageId.trim();
  if (!id || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(AUDIO_URL_STORE);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return typeof map[id] === "string" ? map[id] : null;
  } catch {
    return null;
  }
}

function setSpeaking(active: boolean) {
  if (speaking === active) return;
  speaking = active;
  for (const cb of speakingListeners) cb(active);
}

function clearAudio() {
  if (audioEl) {
    audioEl.onended = null;
    audioEl.onerror = null;
    audioEl.pause();
    audioEl.removeAttribute("src");
    audioEl.load();
    audioEl = null;
  }
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = null;
  }
}

export function isAiSpeaking(): boolean {
  return speaking;
}

/** Subscribe to speak / stop / ended. Returns unsubscribe. */
export function subscribeAiSpeaking(
  cb: (active: boolean) => void,
): () => void {
  speakingListeners.add(cb);
  cb(speaking);
  return () => {
    speakingListeners.delete(cb);
  };
}

export function stopAiSpeech(): void {
  speakGen += 1;
  clearAudio();
  stopBrowser();
  setSpeaking(false);
}

export async function probeElevenLabsReady(): Promise<boolean> {
  if (Date.now() < elevenCooldownUntil) return false;
  if (elevenReadyCache != null) return elevenReadyCache;
  try {
    const res = await fetch("/api/ai/tts");
    const data = (await res.json()) as { ready?: boolean };
    elevenReadyCache = Boolean(data.ready);
  } catch {
    elevenReadyCache = false;
  }
  return elevenReadyCache;
}

function markElevenCooldown(reason: string, ms = 30_000) {
  elevenCooldownUntil = Date.now() + ms;
  elevenReadyCache = null;
  console.warn(
    "[tts] ElevenLabs cooldown",
    Math.round(ms / 1000),
    "s:",
    reason,
  );
}

async function playUrl(
  url: string,
  gen: number,
  finishIfCurrent: () => void,
  asObjectUrl: boolean,
): Promise<boolean> {
  clearAudio();
  if (asObjectUrl) objectUrl = url;
  audioEl = new Audio(url);
  audioEl.setAttribute("playsinline", "true");
  audioEl.onended = finishIfCurrent;
  audioEl.onerror = finishIfCurrent;
  try {
    await audioEl.play();
  } catch {
    finishIfCurrent();
    return false;
  }
  return gen === speakGen;
}

async function playBlob(
  blob: Blob,
  gen: number,
  finishIfCurrent: () => void,
): Promise<boolean> {
  const url = URL.createObjectURL(blob);
  return playUrl(url, gen, finishIfCurrent, true);
}

async function fetchElevenLabsBlob(
  raw: string,
  emotion: SpeakEmotion,
  cacheKey: string,
): Promise<{ blob: Blob; fromNetwork: boolean } | null> {
  const contentKey = ttsContentKey(raw, emotion);
  const dedupeKey = cacheKey || contentKey;

  const byMsg = cacheKey ? blobByMessageId.get(cacheKey) : undefined;
  if (byMsg) return { blob: byMsg, fromNetwork: false };
  const byContent = blobByContentKey.get(contentKey);
  if (byContent) {
    if (cacheKey) rememberTtsBlob(cacheKey, byContent);
    return { blob: byContent, fromNetwork: false };
  }

  const inflight = inflightByKey.get(dedupeKey) ?? inflightByKey.get(contentKey);
  if (inflight) {
    const blob = await inflight;
    return blob ? { blob, fromNetwork: false } : null;
  }

  if (Date.now() < elevenCooldownUntil) return null;

  const run = (async (): Promise<Blob | null> => {
    const res = await fetch("/api/ai/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw, emotion }),
    });

    if (res.status === 503) {
      markElevenCooldown("not configured", 120_000);
      return null;
    }
    if (res.status === 401 || res.status === 402 || res.status === 429) {
      markElevenCooldown(`HTTP ${res.status}`, 60_000);
      return null;
    }
    if (!res.ok) {
      let detail = "";
      try {
        const j = (await res.json()) as { error?: string };
        detail = j.error ?? "";
      } catch {
        /* ignore */
      }
      const lower = detail.toLowerCase();
      if (
        lower.includes("quota") ||
        lower.includes("credit") ||
        lower.includes("payment") ||
        lower.includes("unusual activity")
      ) {
        markElevenCooldown(detail || `HTTP ${res.status}`, 60_000);
      }
      console.info(
        "[tts:fallback]",
        "ElevenLabs failed",
        res.status,
        detail || "",
        "→ browser speech",
      );
      return null;
    }

    const blob = await res.blob();
    elevenReadyCache = true;
    elevenCooldownUntil = 0;
    if (cacheKey) rememberTtsBlob(cacheKey, blob);
    rememberTtsBlobForContent(raw, emotion, blob);
    const cacheHdr = res.headers.get("X-Luwas-TTS-Cache");
    console.info("[tts] network", cacheHdr === "hit" ? "server-cache" : "elevenlabs");
    return blob;
  })();

  inflightByKey.set(dedupeKey, run);
  inflightByKey.set(contentKey, run);

  try {
    const blob = await run;
    if (!blob) return null;
    return { blob, fromNetwork: true };
  } finally {
    inflightByKey.delete(dedupeKey);
    inflightByKey.delete(contentKey);
  }
}

function fallbackBrowser(
  raw: string,
  emotion: SpeakEmotion,
  gen: number,
  finishIfCurrent: () => void,
  browserVoiceUri?: string | null,
): {
  provider: "browser" | "none";
  emotion: SpeakEmotion;
} {
  if (!isBrowserTtsAvailable()) {
    finishIfCurrent();
    return { provider: "none", emotion };
  }
  const ok = speakBrowser(raw, browserVoiceUri);
  if (!ok) {
    finishIfCurrent();
    return { provider: "none", emotion };
  }
  const poll = window.setInterval(() => {
    if (gen !== speakGen) {
      window.clearInterval(poll);
      return;
    }
    if (!window.speechSynthesis.speaking && !window.speechSynthesis.pending) {
      window.clearInterval(poll);
      finishIfCurrent();
    }
  }, 250);
  return { provider: "browser", emotion };
}

/**
 * Speak an AI reply via ElevenLabs (emotion-aware). Falls back to browser TTS.
 * Replay NEVER hits ElevenLabs when a message blob / content blob / audioUrl exists.
 */
export async function speakAiReply(
  raw: string,
  opts?: {
    emotion?: SpeakEmotion;
    browserVoiceUri?: string | null;
    skipIfSpeaking?: boolean;
    cacheKey?: string | null;
    cachedAudioUrl?: string | null;
    onElevenLabsAudio?: (info: {
      blob: Blob;
      emotion: SpeakEmotion;
    }) => void;
  },
): Promise<{
  provider: "elevenlabs" | "browser" | "none";
  emotion: SpeakEmotion;
  fromCache?: boolean;
}> {
  const emotion = opts?.emotion ?? inferSpeakEmotion(raw);
  if (opts?.skipIfSpeaking && speaking) {
    return { provider: "none", emotion };
  }

  const gen = ++speakGen;
  clearAudio();
  stopBrowser();
  setSpeaking(true);

  const finishIfCurrent = () => {
    if (gen === speakGen) setSpeaking(false);
  };

  const cacheKey = opts?.cacheKey?.trim() || "";
  const contentKey = ttsContentKey(raw, emotion);
  const memBlob =
    (cacheKey ? blobByMessageId.get(cacheKey) : undefined) ??
    blobByContentKey.get(contentKey);
  const cached =
    opts?.cachedAudioUrl?.trim() ||
    (cacheKey ? recallAudioUrl(cacheKey) : null) ||
    "";

  // 1) Memory blob — never call ElevenLabs again for this reply.
  if (memBlob) {
    if (cacheKey) rememberTtsBlob(cacheKey, memBlob);
    const ok = await playBlob(memBlob, gen, finishIfCurrent);
    if (gen !== speakGen) return { provider: "none", emotion };
    if (ok) {
      console.info("[tts]", "memory", emotion);
      return { provider: "elevenlabs", emotion, fromCache: true };
    }
    // Play failed (interrupted) — still refuse regenerate; try storage / browser.
  }

  // 2) Saved Storage URL — still never regenerate.
  if (cached) {
    const ok = await playUrl(cached, gen, finishIfCurrent, false);
    if (gen !== speakGen) return { provider: "none", emotion };
    if (ok) {
      console.info("[tts]", "storage", emotion);
      return { provider: "elevenlabs", emotion, fromCache: true };
    }
  }

  // Hard gate: if we already have any cache for this message/content, do NOT
  // burn another ElevenLabs credit — browser only.
  if (memBlob || cached) {
    console.warn("[tts] cache play failed — refusing ElevenLabs regenerate");
    return fallbackBrowser(
      raw,
      emotion,
      gen,
      finishIfCurrent,
      opts?.browserVoiceUri,
    );
  }

  // 3) First play only — one ElevenLabs (or server LRU) call.
  try {
    const fetched = await fetchElevenLabsBlob(raw, emotion, cacheKey);
    if (!fetched) {
      if (gen !== speakGen) return { provider: "none", emotion };
      return fallbackBrowser(
        raw,
        emotion,
        gen,
        finishIfCurrent,
        opts?.browserVoiceUri,
      );
    }

    if (fetched.fromNetwork) {
      try {
        opts?.onElevenLabsAudio?.({ blob: fetched.blob, emotion });
      } catch {
        /* upload is best-effort */
      }
    }

    if (gen !== speakGen) return { provider: "none", emotion };

    const ok = await playBlob(fetched.blob, gen, finishIfCurrent);
    if (gen !== speakGen) {
      clearAudio();
      return { provider: "none", emotion };
    }
    console.info(
      "[tts]",
      fetched.fromNetwork ? "elevenlabs" : "memory",
      emotion,
    );
    if (!ok) finishIfCurrent();
    return {
      provider: "elevenlabs",
      emotion,
      fromCache: !fetched.fromNetwork,
    };
  } catch (err) {
    if (gen !== speakGen) return { provider: "none", emotion };
    console.info(
      "[tts:fallback]",
      "ElevenLabs error → browser speech",
      err instanceof Error ? err.message : err,
    );
  }

  if (gen !== speakGen) return { provider: "none", emotion };
  return fallbackBrowser(
    raw,
    emotion,
    gen,
    finishIfCurrent,
    opts?.browserVoiceUri,
  );
}
