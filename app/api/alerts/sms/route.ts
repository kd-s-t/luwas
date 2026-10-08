import { NextResponse } from "next/server";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import {
  buildEvacEmailBody,
  buildEvacEmailSubject,
  isValidAlertEmail,
} from "@/lib/alerts/emailCopy";
import { emailProviderStatus, sendEmailBatch } from "@/lib/alerts/sendEmail";
import { toE164Ph } from "@/lib/alerts/phones";
import { buildEvacSmsBody } from "@/lib/alerts/smsCopy";
import { sendSmsBatch, smsProviderStatus } from "@/lib/alerts/sendSms";

export const runtime = "nodejs";

type Body = {
  priority?: "evacuate" | "prepare" | "evacuate_and_prepare";
  barangay?: string;
  recipients?: {
    householdId?: string;
    ownerName?: string;
    phone?: string;
    email?: string;
    purok?: string;
    priority?: AssistPriority;
  }[];
};

export async function GET() {
  return NextResponse.json({
    sms: smsProviderStatus(),
    email: emailProviderStatus(),
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.priority ?? "evacuate";
  const list = Array.isArray(body.recipients) ? body.recipients : [];
  if (list.length === 0) {
    return NextResponse.json(
      { error: "No recipients — run triage first." },
      { status: 400 },
    );
  }

  const allowed = new Set<AssistPriority>(
    mode === "evacuate_and_prepare"
      ? ["evacuate", "prepare"]
      : mode === "prepare"
        ? ["prepare"]
        : ["evacuate"],
  );

  const smsPayloads = [];
  const emailPayloads = [];
  const skipped: { ownerName?: string; reason: string }[] = [];

  for (const r of list) {
    const priority = r.priority ?? "evacuate";
    if (!allowed.has(priority)) continue;

    const e164 = toE164Ph(r.phone);
    const email = r.email?.trim() ?? "";
    const emailOk = isValidAlertEmail(email);
    const copy = {
      ownerName: r.ownerName ?? "Resident",
      purok: r.purok,
      priority,
      barangay: body.barangay,
    };

    if (!e164 && !emailOk) {
      skipped.push({
        ownerName: r.ownerName,
        reason: !r.phone?.trim() && !email ? "no phone/email" : "bad phone/email",
      });
      continue;
    }

    if (e164) {
      smsPayloads.push({
        to: e164,
        body: buildEvacSmsBody(copy),
        meta: {
          householdId: r.householdId,
          ownerName: r.ownerName,
          priority,
          phoneDisplay: r.phone?.trim() || e164,
        },
      });
    } else if (r.phone?.trim()) {
      skipped.push({ ownerName: r.ownerName, reason: "bad phone" });
    }

    if (emailOk) {
      emailPayloads.push({
        to: email,
        subject: buildEvacEmailSubject({
          priority,
          barangay: body.barangay,
        }),
        body: buildEvacEmailBody(copy),
        meta: {
          householdId: r.householdId,
          ownerName: r.ownerName,
          priority,
        },
      });
    }
  }

  if (smsPayloads.length === 0 && emailPayloads.length === 0) {
    return NextResponse.json(
      {
        error: "No valid phone or email for that priority.",
        skipped,
        sms: smsProviderStatus(),
        email: emailProviderStatus(),
      },
      { status: 400 },
    );
  }

  const [smsOut, emailOut] = await Promise.all([
    smsPayloads.length
      ? sendSmsBatch(smsPayloads)
      : Promise.resolve({
          provider: smsProviderStatus().provider,
          results: [] as Awaited<ReturnType<typeof sendSmsBatch>>["results"],
        }),
    emailPayloads.length
      ? sendEmailBatch(emailPayloads)
      : Promise.resolve({
          provider: emailProviderStatus().provider,
          results: [] as Awaited<ReturnType<typeof sendEmailBatch>>["results"],
        }),
  ]);

  const results = [
    ...smsOut.results.map((r) => ({
      channel: "sms" as const,
      to: r.to,
      ok: r.ok,
      ownerName: r.ownerName,
      phoneDisplay: r.phoneDisplay ?? r.to,
      priority: r.priority,
      body: r.body,
      error: r.error,
      provider: r.provider,
    })),
    ...emailOut.results.map((r) => ({
      channel: "email" as const,
      to: r.to,
      ok: r.ok,
      ownerName: r.ownerName,
      emailDisplay: r.to,
      priority: r.priority,
      body: r.body,
      subject: r.subject,
      error: r.error,
      provider: r.provider,
    })),
  ];

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    provider: {
      sms: smsOut.provider,
      email: emailOut.provider,
    },
    requested: list.length,
    attempted: results.length,
    smsAttempted: smsPayloads.length,
    emailAttempted: emailPayloads.length,
    sent,
    failed,
    skipped,
    results,
    truncated: false,
  });
}
