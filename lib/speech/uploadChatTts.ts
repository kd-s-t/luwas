import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getClientStorage } from "@/lib/firebase/client";

const MAX_BYTES = 8 * 1024 * 1024;

/** Upload ElevenLabs MPEG for an assistant message — replay via audioUrl. */
export async function uploadChatTts(input: {
  officerUid: string;
  threadId: string;
  messageId: string;
  blob: Blob;
}): Promise<{ audioPath: string; audioUrl: string; audioMime: string }> {
  if (input.blob.size > MAX_BYTES) {
    throw new Error("TTS audio must be under 8 MB.");
  }

  const mime = input.blob.type || "audio/mpeg";
  const ext = mime.includes("wav")
    ? "wav"
    : mime.includes("ogg")
      ? "ogg"
      : "mp3";
  const audioPath = `chat-tts/${input.officerUid}/${input.threadId}/${input.messageId}.${ext}`;
  const storageRef = ref(getClientStorage(), audioPath);

  await uploadBytes(storageRef, input.blob, { contentType: mime });
  const audioUrl = await getDownloadURL(storageRef);
  return { audioPath, audioUrl, audioMime: mime };
}
