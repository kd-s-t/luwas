/**
 * SMS dispatch for barangay phones.
 * Primary: Semaphore (PH SMS API, server-only).
 * Twilio is used for voice calls — see sendCall.ts.
 * Without Semaphore creds, runs in demo mode (logs, no carrier send).
 */

export type SmsSendResult = {
  to: string;
  ok: boolean;
  provider: "semaphore" | "demo";
  sid?: string;
  error?: string;
  body?: string;
  ownerName?: string;
  priority?: string;
  phoneDisplay?: string;
};

export type SmsRecipient = {
  to: string;
  body: string;
  meta?: {
    householdId?: string;
    ownerName?: string;
    priority?: string;
    phoneDisplay?: string;
  };
};

/** Semaphore accepts 09… or 63… (no +). */
function toSemaphoreNumber(e164: string): string {
  return e164.replace(/\D/g, "");
}

function semaphoreConfigured() {
  return Boolean(process.env.SEMAPHORE_API_KEY?.trim());
}

async function sendViaSemaphore(
  to: string,
  body: string,
): Promise<SmsSendResult> {
  const apikey = process.env.SEMAPHORE_API_KEY!.trim();
  const sendername = process.env.SEMAPHORE_SENDER_NAME?.trim();
  const number = toSemaphoreNumber(to);

  const params = new URLSearchParams({
    apikey,
    number,
    message: body,
  });
  if (sendername) params.set("sendername", sendername);

  const res = await fetch("https://api.semaphore.co/api/v4/messages", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = (await res.json()) as
    | {
        message_id?: number | string;
        status?: string;
        recipient?: string;
      }[]
    | { message?: string; error?: string };

  if (!res.ok) {
    const err =
      !Array.isArray(data) && typeof data === "object"
        ? data.message || data.error
        : undefined;
    return {
      to,
      ok: false,
      provider: "semaphore",
      error: err || `Semaphore ${res.status}`,
    };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return {
      to,
      ok: false,
      provider: "semaphore",
      error: "Empty Semaphore response",
    };
  }

  const first = data[0];
  const status = (first.status ?? "").toLowerCase();
  if (status === "failed" || status === "refunded") {
    return {
      to,
      ok: false,
      provider: "semaphore",
      error: `Semaphore status: ${first.status}`,
      sid: first.message_id != null ? String(first.message_id) : undefined,
    };
  }

  return {
    to,
    ok: true,
    provider: "semaphore",
    sid: first.message_id != null ? String(first.message_id) : undefined,
  };
}

export async function sendSmsBatch(
  recipients: SmsRecipient[],
): Promise<{ provider: "semaphore" | "demo"; results: SmsSendResult[] }> {
  const useSemaphore = semaphoreConfigured();
  const results: SmsSendResult[] = [];

  for (const r of recipients) {
    const detail = {
      body: r.body,
      ownerName: r.meta?.ownerName,
      priority: r.meta?.priority,
      phoneDisplay: r.meta?.phoneDisplay ?? r.to,
    };
    if (!useSemaphore) {
      console.info(
        "[sms:demo]",
        r.meta?.priority ?? "alert",
        r.to,
        r.meta?.ownerName ?? "",
        r.body.slice(0, 80),
      );
      results.push({
        to: r.to,
        ok: true,
        provider: "demo",
        sid: `demo-${Date.now()}-${results.length}`,
        ...detail,
      });
      continue;
    }
    try {
      const sent = await sendViaSemaphore(r.to, r.body);
      results.push({ ...sent, ...detail });
    } catch (err) {
      results.push({
        to: r.to,
        ok: false,
        provider: "semaphore",
        error: err instanceof Error ? err.message : "Send failed",
        ...detail,
      });
    }
  }

  return { provider: useSemaphore ? "semaphore" : "demo", results };
}

export function smsProviderStatus(): {
  provider: "semaphore" | "demo";
  ready: boolean;
} {
  const ready = semaphoreConfigured();
  return { provider: ready ? "semaphore" : "demo", ready };
}
