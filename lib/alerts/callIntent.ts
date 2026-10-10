/** Officer asked to dial / voice-alert the priority list (Twilio Voice). */
export function isCallDispatchIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;

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
