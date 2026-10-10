import { NextResponse } from "next/server";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import { buildEvacCallScript } from "@/lib/alerts/callCopy";
import { toE164Ph } from "@/lib/alerts/phones";
import { callProviderStatus, sendCallBatch } from "@/lib/alerts/sendCall";

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
  return NextResponse.json({
    call: callProviderStatus(),
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

  const callPayloads = [];
  const skipped: { ownerName?: string; reason: string }[] = [];

  for (const r of list) {
    const priority = r.priority ?? "evacuate";
    if (!allowed.has(priority)) continue;

    const e164 = toE164Ph(r.phone);
    if (!e164) {
      skipped.push({
        ownerName: r.ownerName,
        reason: !r.phone?.trim() ? "no phone" : "bad phone",
      });
      continue;
    }

    callPayloads.push({
      to: e164,
      body: buildEvacCallScript({
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

  if (callPayloads.length === 0) {
    return NextResponse.json(
      {
        error: "No valid phone for that priority.",
        skipped,
        call: callProviderStatus(),
      },
      { status: 400 },
    );
  }

  const callOut = await sendCallBatch(callPayloads);

  const results = callOut.results.map((r) => ({
    channel: "call" as const,
    to: r.to,
    ok: r.ok,
    ownerName: r.ownerName,
    phoneDisplay: r.phoneDisplay ?? r.to,
    priority: r.priority,
    body: r.body,
    error: r.error,
    provider: r.provider,
  }));

  const sent = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;

  return NextResponse.json({
    provider: { call: callOut.provider },
    requested: list.length,
    attempted: results.length,
    callAttempted: callPayloads.length,
    sent,
    failed,
    skipped,
    results,
    truncated: false,
  });
}
