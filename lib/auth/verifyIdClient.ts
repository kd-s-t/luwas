import type { AcceptedIdType, IdVerificationResult } from "@/lib/auth/idTypes";
import { fileToBase64 } from "@/lib/auth/idUpload";

export async function verifyIdWithApi(input: {
  idType: AcceptedIdType;
  displayName: string;
  idFile: File;
  faceFile: File;
}): Promise<IdVerificationResult> {
  const [idImageBase64, faceImageBase64] = await Promise.all([
    fileToBase64(input.idFile),
    fileToBase64(input.faceFile),
  ]);

  const res = await fetch("/api/ai/verify-id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idType: input.idType,
      displayName: input.displayName,
      idImageBase64,
      idImageMime: input.idFile.type || "image/jpeg",
      faceImageBase64,
      faceImageMime: input.faceFile.type || "image/jpeg",
    }),
  });

  if (!res.ok) {
    throw new Error(`ID verification failed (${res.status})`);
  }

  return (await res.json()) as IdVerificationResult;
}
