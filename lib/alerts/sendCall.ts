/**
 * Voice call dispatch for barangay phones.
 * Primary: Twilio Voice REST API (server-only).
 * SMS texting uses Semaphore — see sendSms.ts.
 * Without Twilio creds, runs in demo mode (logs, no dial).
 */

export type CallSendResult = {
  to: string;
  ok: boolean;
  provider: "twilio" | "demo";
  sid?: string;
  error?: string;
  body?: string;
  ownerName?: string;
  priority?: string;
  phoneDisplay?: string;
};

export type CallRecipient = {
  to: string;
  /** Spoken script (plain text; escaped into TwiML). */
  body: string;
  meta?: {
    householdId?: string;
    ownerName?: string;
    priority?: string;
    phoneDisplay?: string;
  };
};

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildSayTwiml(script: string): string {
  const say = escapeXml(script);
  return `<Response><Say voice="alice">${say}</Say></Response>`;
}

async function callViaTwilio(
  to: string,
  script: string,
): Promise<CallSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: to,
    From: from,
    Twiml: buildSayTwiml(script),
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  );

  const data = (await res.json()) as {
    sid?: string;
    message?: string;
    error_message?: string;
  };

  if (!res.ok) {
    return {
      to,
      ok: false,
      provider: "twilio",
      error: data.error_message || data.message || `Twilio ${res.status}`,
    };
  }

  return { to, ok: true, provider: "twilio", sid: data.sid };
}

export async function sendCallBatch(
  recipients: CallRecipient[],
): Promise<{ provider: "twilio" | "demo"; results: CallSendResult[] }> {
  const useTwilio = twilioConfigured();
  const results: CallSendResult[] = [];

  for (const r of recipients) {
    const detail = {
      body: r.body,
      ownerName: r.meta?.ownerName,
      priority: r.meta?.priority,
      phoneDisplay: r.meta?.phoneDisplay ?? r.to,
    };
    if (!useTwilio) {
      console.info(
        "[call:demo]",
        r.meta?.priority ?? "alert",
        r.to,
        r.meta?.ownerName ?? "",
        r.body.slice(0, 80),
      );
      results.push({
        to: r.to,
        ok: true,
        provider: "demo",
        sid: `demo-call-${Date.now()}-${results.length}`,
        ...detail,
      });
      continue;
    }
    try {
      const sent = await callViaTwilio(r.to, r.body);
      results.push({ ...sent, ...detail });
    } catch (err) {
      results.push({
        to: r.to,
        ok: false,
        provider: "twilio",
        error: err instanceof Error ? err.message : "Call failed",
        ...detail,
      });
    }
  }

  return { provider: useTwilio ? "twilio" : "demo", results };
}

export function callProviderStatus(): {
  provider: "twilio" | "demo";
  ready: boolean;
} {
  const ready = twilioConfigured();
  return { provider: ready ? "twilio" : "demo", ready };
}
