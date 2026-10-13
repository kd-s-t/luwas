/**
 * SMS dispatch for barangay phones.
 * Primary: Twilio Messages API (same TWILIO_* env as Voice).
 * Without Twilio creds, runs in demo mode (logs, no carrier send).
 * Note: US toll-free SMS needs Twilio Messaging / TFV approval before delivery.
 *
 * Sandbox: TWILIO_SANDBOX=mode redirects every SMS to TWILIO_SANDBOX_TO
 * (same list as Voice; verify numbers in Twilio for trial).
 */

import { twilioSandboxTos } from "@/lib/alerts/twilioSandbox";

export type SmsProvider = "twilio" | "demo";

export type SmsSendResult = {
  to: string;
  ok: boolean;
  provider: SmsProvider;
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

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_FROM_NUMBER?.trim(),
  );
}

async function sendViaTwilio(
  to: string,
  body: string,
): Promise<SmsSendResult> {
  const sid = process.env.TWILIO_ACCOUNT_SID!.trim();
  const token = process.env.TWILIO_AUTH_TOKEN!.trim();
  const from = process.env.TWILIO_FROM_NUMBER!.trim();
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({
    To: to,
    From: from,
    Body: body,
  });

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
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

export async function sendSmsBatch(
  recipients: SmsRecipient[],
): Promise<{ provider: SmsProvider; results: SmsSendResult[] }> {
  const useTwilio = twilioConfigured();
  const results: SmsSendResult[] = [];
  const sandboxTos = twilioSandboxTos();

  for (const r of recipients) {
    const detail = {
      body: r.body,
      ownerName: r.meta?.ownerName,
      priority: r.meta?.priority,
      phoneDisplay: r.meta?.phoneDisplay ?? r.to,
    };
    if (!useTwilio) {
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

    const smsTargets = sandboxTos.length > 0 ? sandboxTos : [r.to];
    const body =
      sandboxTos.length > 0
        ? `LUWAS sandbox. Intended for ${detail.phoneDisplay}. ${r.body}`
        : r.body;

    for (const smsTo of smsTargets) {
      if (sandboxTos.length > 0) {
        console.info(
          "[sms:sandbox]",
          "intended",
          r.to,
          "→ sms",
          smsTo,
          r.meta?.ownerName ?? "",
        );
      }
      try {
        const sent = await sendViaTwilio(smsTo, body);
        results.push({
          ...sent,
          // Keep intended recipient in the log; actual SMS is sandbox when set.
          to: r.to,
          ...detail,
          body,
        });
      } catch (err) {
        results.push({
          to: r.to,
          ok: false,
          provider: "twilio",
          error: err instanceof Error ? err.message : "Send failed",
          ...detail,
          body,
        });
      }
    }
  }

  return { provider: useTwilio ? "twilio" : "demo", results };
}

export function smsProviderStatus(): {
  provider: SmsProvider;
  ready: boolean;
} {
  const ready = twilioConfigured();
  return { provider: ready ? "twilio" : "demo", ready };
}
