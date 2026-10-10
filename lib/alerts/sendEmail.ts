/**
 * Email alert dispatch for household contacts.
 * Primary: Resend HTTP API (server-only).
 * Without RESEND_* creds, runs in demo mode (logs, no inbox send).
 */

export type EmailSendResult = {
  to: string;
  ok: boolean;
  provider: "resend" | "demo";
  id?: string;
  error?: string;
  subject?: string;
  body?: string;
  ownerName?: string;
  priority?: string;
};

export type EmailRecipient = {
  to: string;
  subject: string;
  /** Plain-text body */
  body: string;
  /** Branded HTML body (preferred for Resend) */
  html?: string;
  meta?: {
    householdId?: string;
    ownerName?: string;
    priority?: string;
  };
};

function resendConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim(),
  );
}

/** Synthetic roster inboxes — log only so Resend quota stays for real addresses. */
function isSyntheticInbox(email: string) {
  const e = email.trim().toLowerCase();
  return (
    e.endsWith(".demo") ||
    e.endsWith("@nangka.consolacion.demo") ||
    e.endsWith("@nangka.citizen.demo")
  );
}

async function sendViaResend(
  to: string,
  subject: string,
  text: string,
  html?: string,
): Promise<EmailSendResult> {
  const key = process.env.RESEND_API_KEY!.trim();
  const from = process.env.RESEND_FROM_EMAIL!.trim();
  const payload: Record<string, unknown> = {
    from,
    to: [to],
    subject,
    text,
  };
  if (html?.trim()) {
    payload.html = html;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { id?: string; message?: string };
  if (!res.ok) {
    return {
      to,
      ok: false,
      provider: "resend",
      error: data.message || `Resend ${res.status}`,
    };
  }
  return { to, ok: true, provider: "resend", id: data.id };
}

export async function sendEmailBatch(
  recipients: EmailRecipient[],
): Promise<{ provider: "resend" | "demo"; results: EmailSendResult[] }> {
  const useResend = resendConfigured();
  const results: EmailSendResult[] = [];

  for (const r of recipients) {
    const detail = {
      subject: r.subject,
      body: r.body,
      ownerName: r.meta?.ownerName,
      priority: r.meta?.priority,
    };
    if (!useResend || isSyntheticInbox(r.to)) {
      console.info(
        useResend ? "[email:sim-roster]" : "[email:demo]",
        r.meta?.priority ?? "alert",
        r.to,
        r.meta?.ownerName ?? "",
        r.subject,
        r.html ? "(html)" : "(text-only)",
      );
      results.push({
        to: r.to,
        ok: true,
        provider: "demo",
        id: `demo-email-${Date.now()}-${results.length}`,
        ...detail,
      });
      continue;
    }
    try {
      const sent = await sendViaResend(r.to, r.subject, r.body, r.html);
      results.push({ ...sent, ...detail });
    } catch (err) {
      results.push({
        to: r.to,
        ok: false,
        provider: "resend",
        error: err instanceof Error ? err.message : "Send failed",
        ...detail,
      });
    }
  }

  return { provider: useResend ? "resend" : "demo", results };
}

export function emailProviderStatus(): {
  provider: "resend" | "demo";
  ready: boolean;
} {
  const ready = resendConfigured();
  return { provider: ready ? "resend" : "demo", ready };
}
