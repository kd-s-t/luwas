import { NextResponse } from "next/server";
import { mailFromDisplay } from "@/lib/email/branded";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATES,
  isEmailTemplateId,
} from "@/lib/email/registry";
import { buildEmailTemplate } from "@/lib/email/templates";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const template = searchParams.get("template");

  if (template) {
    if (!isEmailTemplateId(template)) {
      return NextResponse.json({ error: "Unknown template" }, { status: 400 });
    }
    const built = buildEmailTemplate(template);
    return NextResponse.json({
      template,
      preview: {
        subject: built.subject,
        from: mailFromDisplay(),
        html: built.html,
        text: built.text,
      },
    });
  }

  return NextResponse.json({
    categories: EMAIL_TEMPLATE_CATEGORIES,
    templates: EMAIL_TEMPLATES,
  });
}
