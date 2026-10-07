import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getClientStorage } from "@/lib/firebase/client";

const MAX_BYTES = 28 * 1024 * 1024;

export async function uploadReportMedia(input: {
  citizenUid: string;
  reportId: string;
  file: File;
}): Promise<{ mediaPath: string; mediaUrl: string; mediaMime: string }> {
  if (input.file.size > MAX_BYTES) {
    throw new Error("Media must be under 28 MB.");
  }

  const safeName = input.file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
  const mediaPath = `reports/${input.citizenUid}/${input.reportId}/${safeName}`;
  const storageRef = ref(getClientStorage(), mediaPath);

  await uploadBytes(storageRef, input.file, {
    contentType: input.file.type || "application/octet-stream",
  });

  const mediaUrl = await getDownloadURL(storageRef);
  return {
    mediaPath,
    mediaUrl,
    mediaMime: input.file.type || "application/octet-stream",
  };
}

/** Read file as base64 (no data: prefix) for Gemini inline validation. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Could not read media file"));
    reader.readAsDataURL(file);
  });
}
