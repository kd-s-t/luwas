import { NextResponse } from "next/server";
import { isValidAlertEmail } from "@/lib/alerts/emailCopy";
import { sendEmailBatch } from "@/lib/alerts/sendEmail";
import { buildReportDoneEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

type DoneRole = "reporter" | "assignee" | "captain";

type Recipient = {
  email?: string;
  name?: string;
  role?: DoneRole;
};

type Body = {
  recipients?: Recipient[];
  reportId?: string;
  title?: string;
  hazardLabel?: string;
  place?: string;
  notes?: string;
  barangay?: string;
  lgu?: string;
  closedByName?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = Array.isArray(body.recipients) ? body.recipients : [];
  const seen = new Set<string>();
  const recipients: { email: string; name: string; role: DoneRole }[] = [];
  for (const r of raw) {
    const email = r.email?.trim() ?? "";
    if (!isValidAlertEmail(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const role: DoneRole =
      r.role === "assignee" || r.role === "captain" ? r.role : "reporter";
    recipients.push({
      email,
      name: r.name?.trim() || "Recipient",
      role,
    });
  }

  if (recipients.length === 0) {
    return NextResponse.json(
      { error: "No valid recipient emails", sent: 0 },
      { status: 400 },
    );
  }

  const report = {
    id: body.reportId?.trim() || "report",
    title: body.title?.trim() || "Citizen report",
    hazardLabel: body.hazardLabel?.trim() || "Hazard",
    place: body.place?.trim() || "",
    notes: body.notes?.trim() || undefined,
  };
  const barangay = body.barangay?.trim() || "Barangay";
  const lgu = body.lgu?.trim() || "";
  const closedByName = body.closedByName?.trim() || "Barangay officer";

  const payloads = recipients.map((r) => {
    const parts = buildReportDoneEmail({
      name: r.name,
      email: r.email,
      phone: "",
      barangay,
      lgu,
      purok: "",
      home: { lat: 10.369166, lng: 123.962317 },
      report,
      doneRole: r.role,
      closedByName,
    });
    return {
      to: r.email,
      subject: parts.subject,
      body: parts.text,
      html: parts.html,
      meta: {
        ownerName: r.name,
        priority: "report_done",
      },
    };
  });

  const { provider, results } = await sendEmailBatch(payloads);
  const sent = results.filter((x) => x.ok).length;

  return NextResponse.json({
    ok: sent > 0,
    provider,
    sent,
    results,
  });
}
