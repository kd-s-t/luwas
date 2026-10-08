import { NextResponse } from "next/server";
import type { AssistPriority } from "@/lib/ai/assistTypes";
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
    purok?: string;
    priority?: AssistPriority;
  }[];
};

export async function GET() {
  return NextResponse.json(smsProviderStatus());
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

  const payloads = [];
  const skipped: { ownerName?: string; reason: string }[] = [];

  for (const r of list) {
    const priority = r.priority ?? "evacuate";
    if (!allowed.has(priority)) continue;
    const e164 = toE164Ph(r.phone);
    if (!e164) {
      skipped.push({
        ownerName: r.ownerName,
        reason: r.phone?.trim() ? "bad phone" : "no phone",
      });
      continue;
    }
    payloads.push({
      to: e164,
      body: buildEvacSmsBody({
        ownerName: r.ownerName ?? "Resident",
        purok: r.purok,
        priority,
        barangay: body.barangay,
      }),
      meta: {
        householdId: r.householdId,
        ownerName: r.ownerName,
        priority,
        phoneDisplay: r.phone?.trim() || e164,
      },
    });
  }

  if (payloads.length === 0) {
    return NextResponse.json(
      {
        error: "No valid phone numbers for that priority.",
        skipped,
        ...smsProviderStatus(),
      },
      { status: 400 },
    );
  }

  const { provider, results } = await sendSmsBatch(payloads);
  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    provider,
    requested: list.length,
    attempted: payloads.length,
    sent,
    failed,
    skipped,
    results,
    truncated: false,
  });
}
