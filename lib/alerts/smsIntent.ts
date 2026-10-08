/** Officer asked Mangluluwas to SMS the priority / evacuate list. */
export function isSmsDispatchIntent(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /\b(text|sms|message)\b/i.test(t) &&
    /\b(evac|evacuate|them|household|priority|prepare|call\s*list|triage)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\bsend\b/i.test(t) &&
    /\b(text|sms|message|evac|evacuate)\b/i.test(t)
  ) {
    return true;
  }
  return false;
}

export function smsPriorityFromIntent(
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
