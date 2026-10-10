import { NextResponse } from "next/server";
import {
  TEXT_TEMPLATE_CATEGORIES,
  TEXT_TEMPLATES,
  isTextTemplateId,
} from "@/lib/sms/registry";
import { buildTextTemplate } from "@/lib/sms/templates";
import { DEFAULT_EMAIL_SAMPLE } from "@/lib/email/templates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const template = searchParams.get("template");

  if (template) {
    if (!isTextTemplateId(template)) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    const built = buildTextTemplate(template);
    // Sender line under “LUWAS Alerts” (Smart / Messages style) — Semaphore sender name.
    const from =
      process.env.SEMAPHORE_SENDER_NAME?.trim() || "LUWAS";
    return NextResponse.json({
      template,
      preview: {
        to: DEFAULT_EMAIL_SAMPLE.phone,
        from,
        body: built.body,
        segments: built.segments,
        chars: built.body.length,
      },
    });
  }

  return NextResponse.json({
    categories: TEXT_TEMPLATE_CATEGORIES,
    templates: TEXT_TEMPLATES,
  });
}
