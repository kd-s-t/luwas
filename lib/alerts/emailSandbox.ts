/**
 * Parse RESEND_SANDBOX_TO as an email list.
 * Accepts: `a@x.com,b@y.com` or `["a@x.com","b@y.com"]`.
 */
export function parseSandboxEmailList(raw: string): string[] {
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

  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const e = part.trim().toLowerCase();
    if (!e.includes("@") || seen.has(e)) continue;
    seen.add(e);
    out.push(e);
  }
  return out;
}

/**
 * When RESEND_SANDBOX is on (true/1/mode/yes) and RESEND_SANDBOX_TO is set,
 * every outbound alert email is redirected to those inboxes.
 */
export function resendSandboxTos(): string[] {
  const flag = process.env.RESEND_SANDBOX?.trim().toLowerCase();
  if (flag !== "true" && flag !== "1" && flag !== "mode" && flag !== "yes") {
    return [];
  }
  const raw = process.env.RESEND_SANDBOX_TO?.trim();
  if (!raw) return [];
  return parseSandboxEmailList(raw);
}
