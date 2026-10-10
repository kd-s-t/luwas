import type { ResponderCallKind } from "@/lib/alerts/responderCall";

/** Officer asked to dial / voice-alert household priority list (Twilio Voice). */
export function isCallDispatchIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (isResponderCallIntent(t)) return false;

  // "call list" alone means show the panel, not dial.
  if (
    /\bcall\s*list\b/i.test(t) &&
    !/\b(them|households?|residents?|evac|phone|dial|voice|now)\b/i.test(t)
  ) {
    return false;
  }

  if (
    /\b(call|phone|dial|ring)\b/i.test(t) &&
    /\b(them|households?|residents?|evac|evacuate|priority|prepare)\b/i.test(t)
  ) {
    return true;
  }

  if (/\b(voice\s*alert|phone\s*blast|call\s*blast)\b/i.test(t)) {
    return true;
  }

  return false;
}

export function callPriorityFromIntent(
  text: string,
): "evacuate" | "evacuate_and_prepare" {
  if (/\bprepare\b/i.test(text) && !/\bevac/i.test(text)) {
    return "evacuate_and_prepare";
  }
  if (/\b(all|everyone|priority)\b/i.test(text)) {
    return "evacuate_and_prepare";
  }
  return "evacuate";
}

/** Officer asked to call BFP / PNP / hospital / barangay desk. */
export function isResponderCallIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (!/\b(call|phone|dial|ring|contact)\b/i.test(t)) return false;
  return responderKindsFromIntent(t).length > 0;
}

export function responderKindsFromIntent(text: string): ResponderCallKind[] {
  const t = text.trim();
  const kinds: ResponderCallKind[] = [];
  const add = (k: ResponderCallKind) => {
    if (!kinds.includes(k)) kinds.push(k);
  };

  if (/\b(bfp|fire\s*station|fire\s*dept|firefighters?|bombero)\b/i.test(t)) {
    add("bfp");
  }
  if (/\b(pnp|police|pulis|\bmps\b)\b/i.test(t)) {
    add("pnp");
  }
  if (/\b(hospital|medical\s*center|mendero|\brhu\b)\b/i.test(t)) {
    add("hospital");
  }
  if (/\b(tanod|barangay\s*hall|brgy\.?\s*hall)\b/i.test(t)) {
    add("tanod");
  }
  if (
    kinds.length === 0 &&
    /\b(responders?|emergency\s*services?|agencies)\b/i.test(t)
  ) {
    return ["bfp", "pnp"];
  }
  return kinds;
}
