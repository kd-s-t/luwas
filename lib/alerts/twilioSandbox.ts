import { toE164Ph } from "@/lib/alerts/phones";

/**
 * Parse TWILIO_SANDBOX_TO as a phone list.
 * Accepts: `0960…,09…` or `["0960…","09…"]`.
 */
export function parseSandboxToList(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  let parts: string[];
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      parts = Array.isArray(parsed)
        ? parsed.map((p) => String(p))
        : [trimmed];
    } catch {
      parts = [trimmed];
    }
  } else {
    parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  }

  const e164: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const n = toE164Ph(part);
    if (n && !seen.has(n)) {
      seen.add(n);
      e164.push(n);
    }
  }
  return e164;
}

/**
 * When TWILIO_SANDBOX is on (true/1/mode/yes) and TWILIO_SANDBOX_TO is set,
 * every outbound Voice call and SMS is redirected to those numbers.
 */
export function twilioSandboxTos(): string[] {
  const flag = process.env.TWILIO_SANDBOX?.trim().toLowerCase();
  if (flag !== "true" && flag !== "1" && flag !== "mode" && flag !== "yes") {
    return [];
  }
  const raw = process.env.TWILIO_SANDBOX_TO?.trim();
  if (!raw) return [];
  return parseSandboxToList(raw);
}

export function twilioSandboxActive(): boolean {
  return twilioSandboxTos().length > 0;
}
