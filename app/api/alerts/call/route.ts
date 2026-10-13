import { NextResponse } from "next/server";
import type { AssistPriority } from "@/lib/ai/assistTypes";
import {
  buildEvacCallScript,
  buildIncidentAlertCallScript,
  buildResponderCallScript,
} from "@/lib/alerts/callCopy";
import { toE164Ph } from "@/lib/alerts/phones";
import {
  resolveResponderCalls,
  type ResponderCallKind,
} from "@/lib/alerts/responderCall";
import { callProviderStatus, sendCallBatch } from "@/lib/alerts/sendCall";
import { buildIncidentAlertSmsBody } from "@/lib/alerts/smsCopy";
import { sendSmsBatch, smsProviderStatus } from "@/lib/alerts/sendSms";

export const runtime = "nodejs";

const RESPONDER_KINDS = new Set<ResponderCallKind>([
  "bfp",
  "pnp",
  "hospital",
  "tanod",
]);

type HouseholdRecipient = {
  householdId?: string;
  ownerName?: string;
  phone?: string;
  purok?: string;
  priority?: AssistPriority;
};

type Body = {
  /** households (default) or curated BFP/PNP/hospital/tanod stations */
  target?: "households" | "responders";
  priority?: "evacuate" | "prepare" | "evacuate_and_prepare";
  barangay?: string;
  lgu?: string;
  kinds?: string[];
  reason?: string;
  /** Brief auto incident script (<1 min) after AI legit fire/crime/accident. */
  script?: "default" | "fire_alert" | "incident_alert";
  alertLabel?: string | null;
  nearLat?: number | null;
  nearLng?: number | null;
  purok?: string | null;
  title?: string | null;
  recipients?: HouseholdRecipient[];
};

export async function GET() {
  return NextResponse.json({
    call: callProviderStatus(),
    sms: smsProviderStatus(),
  });
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.target === "responders") {
    return postResponderCalls(body);
  }
  return postHouseholdCalls(body);
}

async function postResponderCalls(body: Body) {
  const lgu = body.lgu?.trim() || "Consolacion";
  const barangay = body.barangay?.trim() || "Nangka";
  const kinds = (Array.isArray(body.kinds) ? body.kinds : [])
    .map((k) => k.trim().toLowerCase())
    .filter((k): k is ResponderCallKind =>
      RESPONDER_KINDS.has(k as ResponderCallKind),
    );

  if (kinds.length === 0) {
    return NextResponse.json(
      { error: "No responder kinds — use bfp, pnp, hospital, or tanod." },
      { status: 400 },
    );
  }

  const near =
    typeof body.nearLat === "number" &&
    typeof body.nearLng === "number" &&
    Number.isFinite(body.nearLat) &&
    Number.isFinite(body.nearLng)
      ? { lat: body.nearLat, lng: body.nearLng }
      : null;

  const resolved = resolveResponderCalls({ lgu, barangay, kinds, near });
  if (resolved.length === 0) {
    return NextResponse.json(
      {
        error: "No dialable station numbers for those responders.",
        call: callProviderStatus(),
      },
      { status: 400 },
    );
  }

  const useIncidentAlert =
    body.script === "incident_alert" || body.script === "fire_alert";
  const alertLabel =
    body.alertLabel?.trim() ||
    (body.script === "fire_alert" ? "fire" : "incident");

  const callPayloads = resolved.map((r) => ({
    to: r.to,
    body: useIncidentAlert
      ? buildIncidentAlertCallScript({
          alertLabel,
          stationName: r.stationName,
          barangay,
          lgu,
          purok: body.purok,
          title: body.title,
          lat: near?.lat ?? null,
          lng: near?.lng ?? null,
        })
      : buildResponderCallScript({
          kind: r.kind,
          stationName: r.stationName,
          barangay,
          lgu,
          reason: body.reason,
        }),
    meta: {
      ownerName: r.stationName,
      priority: r.kind,
      phoneDisplay: r.phoneDisplay,
    },
  }));

  const smsBody = useIncidentAlert
    ? buildIncidentAlertSmsBody({
        alertLabel,
        barangay,
        purok: body.purok,
        title: body.title,
        lat: near?.lat ?? null,
        lng: near?.lng ?? null,
      })
    : (
        `LUWAS MDRRMO · Brgy ${barangay}, ${lgu}: ` +
        `${body.reason?.trim() || "Please stand by for barangay coordination."} ` +
        `Tino simulation.`
      );

  const smsPayloads = resolved.map((r) => ({
    to: r.to,
    body: smsBody,
    meta: {
      ownerName: r.stationName,
      priority: r.kind,
      phoneDisplay: r.phoneDisplay,
    },
  }));

  const [callOut, smsOut] = await Promise.all([
    sendCallBatch(callPayloads),
    sendSmsBatch(smsPayloads),
  ]);

  const callResults = callOut.results.map((r, i) => ({
    channel: "call" as const,
    to: r.to,
    ok: r.ok,
    ownerName: r.ownerName ?? resolved[i]?.stationName,
    phoneDisplay: r.phoneDisplay ?? r.to,
    priority: r.priority ?? resolved[i]?.kind,
    body: r.body,
    error: r.error,
    provider: r.provider,
    stationId: resolved[i]?.stationId,
    kind: resolved[i]?.kind,
  }));

  const smsResults = smsOut.results.map((r, i) => ({
    channel: "sms" as const,
    to: r.to,
    ok: r.ok,
    ownerName: r.ownerName ?? resolved[i]?.stationName,
    phoneDisplay: r.phoneDisplay ?? r.to,
    priority: r.priority ?? resolved[i]?.kind,
    body: r.body,
    error: r.error,
    provider: r.provider,
    stationId: resolved[i]?.stationId,
    kind: resolved[i]?.kind,
  }));

  const results = [...smsResults, ...callResults];

  return NextResponse.json({
    provider: { call: callOut.provider, sms: smsOut.provider },
    target: "responders",
    requested: kinds.length,
    attempted: results.length,
    callAttempted: callPayloads.length,
    smsAttempted: smsPayloads.length,
    sent: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    skipped: [],
    results,
    truncated: false,
  });
}

async function postHouseholdCalls(body: Body) {
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
    target: "households",
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
