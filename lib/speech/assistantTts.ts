"use client";

import type { ChatMessage } from "@/lib/ai/chatTypes";
import { readTtsMuted } from "@/lib/speech/browserTts";
import {
  recallAudioUrl,
  rememberAudioUrl,
  rememberTtsBlob,
  rememberTtsBlobForContent,
  speakAiReply,
} from "@/lib/speech/elevenTts";
import { uploadChatTts } from "@/lib/speech/uploadChatTts";

/** One auto-speak per message across remounts / chat effect + useAiAssist. */
export const autoSpokenMessageIds = new Set<string>();
const uploadedTtsMessageIds = new Set<string>();
const uploadingTtsMessageIds = new Set<string>();

export type PersistedTtsAudio = {
  audioUrl: string;
  audioStoragePath: string;
  ttsEmotion?: string;
  ttsProvider?: "elevenlabs" | "browser";
};

/**
 * Gemini reply → infer emotion → ElevenLabs (once) → play → save audioUrl.
 * Replay uses memory / sessionStorage / Storage URL — never a second ElevenLabs call.
 */
export async function speakAndPersistAssistantReply(input: {
  message: ChatMessage;
  officerUid: string | null | undefined;
  threadId: string;
  browserVoiceUri?: string | null;
  /** Manual Speak button — allow replay even if auto-speak already ran. */
  manual?: boolean;
  skipIfSpeaking?: boolean;
  onSaved?: (messageId: string, audio: PersistedTtsAudio) => void;
}): Promise<void> {
  const m = input.message;
  if (m.role !== "assistant" || !m.content.trim()) return;

  if (!input.manual) {
    if (readTtsMuted()) return;
    if (autoSpokenMessageIds.has(m.id)) return;
    autoSpokenMessageIds.add(m.id);
  }

  const cachedAudioUrl = m.audioUrl?.trim() || recallAudioUrl(m.id) || null;

  await speakAiReply(m.content, {
    browserVoiceUri: input.browserVoiceUri,
    skipIfSpeaking: input.skipIfSpeaking,
    cacheKey: m.id,
    cachedAudioUrl,
    onElevenLabsAudio: (info) => {
      rememberTtsBlob(m.id, info.blob);
      rememberTtsBlobForContent(m.content, info.emotion, info.blob);
      if (m.audioUrl || uploadedTtsMessageIds.has(m.id)) return;

      const uid = input.officerUid?.trim();
      const persist = input.onSaved;
      if (!uid || !persist) {
        console.warn("[tts] cannot save audioUrl — missing officerUid / onSaved", {
          messageId: m.id,
        });
        return;
      }
      if (uploadingTtsMessageIds.has(m.id)) return;

      uploadingTtsMessageIds.add(m.id);
      void uploadChatTts({
        officerUid: uid,
        threadId: input.threadId,
        messageId: m.id,
        blob: info.blob,
      })
        .then((up) => {
          uploadedTtsMessageIds.add(m.id);
          rememberAudioUrl(m.id, up.audioUrl);
          persist(m.id, {
            audioUrl: up.audioUrl,
            audioStoragePath: up.audioPath,
            ttsEmotion: info.emotion,
            ttsProvider: "elevenlabs",
          });
          console.info("[tts] saved audioUrl after Gemini reply", m.id);
        })
        .catch((err) => {
          console.error("[tts] Storage upload failed", err);
        })
        .finally(() => {
          uploadingTtsMessageIds.delete(m.id);
        });
    },
  });
}
