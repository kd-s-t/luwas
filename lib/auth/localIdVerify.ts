import type { AcceptedIdType, IdVerificationResult } from "@/lib/auth/idTypes";

/** Fallback when Gemini is unavailable — requires both images present. */
export function runLocalIdVerify(input: {
  idType: AcceptedIdType;
  displayName: string;
  hasIdImage: boolean;
  hasFaceImage: boolean;
}): IdVerificationResult {
  if (!input.hasIdImage || !input.hasFaceImage) {
    return {
      verified: false,
      idType: input.idType,
      confidence: 0.2,
      extractedName: null,
      reason: "Both an ID photo and a face selfie are required.",
      source: "local",
    };
  }

  const name = input.displayName.trim();
  if (name.length < 3) {
    return {
      verified: false,
      idType: input.idType,
      confidence: 0.3,
      extractedName: null,
      reason: "Enter your full name as it appears on the ID.",
      source: "local",
    };
  }

  return {
    verified: true,
    idType: input.idType,
    confidence: 0.55,
    extractedName: name,
    reason: `Local check accepted ${input.idType.toUpperCase()} + selfie for ${name}. Gemini unavailable — officer may re-check.`,
    source: "local",
  };
}
