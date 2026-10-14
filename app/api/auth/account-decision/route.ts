import { NextResponse } from "next/server";
import { isValidAlertEmail } from "@/lib/alerts/emailCopy";
import { sendEmailBatch } from "@/lib/alerts/sendEmail";
import {
  buildAccountApprovedEmail,
  buildAccountRejectedEmail,
} from "@/lib/email/templates";

export const runtime = "nodejs";

type Body = {
  decision?: "approved" | "rejected";
  email?: string;
  name?: string;
  barangay?: string;
  lgu?: string;
  purok?: string;
  phone?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "decision must be approved or rejected" },
      { status: 400 },
    );
  }

  const email = body.email?.trim() ?? "";
  if (!isValidAlertEmail(email)) {
    return NextResponse.json(
      { error: "Valid email required" },
      { status: 400 },
    );
  }

  const ctx = {
    name: body.name?.trim() || "Resident",
    email,
    phone: body.phone?.trim() || "",
    barangay: body.barangay?.trim() || "Barangay",
    lgu: body.lgu?.trim() || "",
    purok: body.purok?.trim() || "",
    home: { lat: 10.369166, lng: 123.962317 },
  };

  const parts =
    decision === "approved"
      ? buildAccountApprovedEmail(ctx)
      : buildAccountRejectedEmail(ctx);

  const { provider, results } = await sendEmailBatch([
    {
      to: email,
      subject: parts.subject,
      body: parts.text,
      html: parts.html,
      meta: {
        ownerName: ctx.name,
        priority: decision === "approved" ? "account_approved" : "account_rejected",
      },
    },
  ]);

  return NextResponse.json({
    ok: results[0]?.ok ?? false,
    provider,
    result: results[0] ?? null,
  });
}
