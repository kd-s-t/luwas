import { NextResponse } from "next/server";
import { escapeHtml } from "@/lib/email/branded";
import { isEmailTemplateId } from "@/lib/email/registry";
import { buildEmailTemplate } from "@/lib/email/templates";

export const runtime = "nodejs";

/**
 * Offline survival kit: opens the alert email in a print view.
 * Recipients use Print → Save as PDF while they still have signal.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("template")?.trim() || "typhoon_alert";
  const template = isEmailTemplateId(raw) ? raw : "typhoon_alert";
  const built = buildEmailTemplate(template);
  const autoPrint = searchParams.get("print") !== "0";
  const titleBase = `LUWAS-${template.replace(/_/g, "-")}-offline`;
  const bodyInner =
    built.html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? built.html;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(built.subject)} · Offline kit</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f7ecec;
      color: #1f2126;
    }
    .bar {
      position: sticky;
      top: 0;
      z-index: 20;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      background: #e30613;
      color: #fff;
      box-shadow: 0 2px 10px rgba(0,0,0,0.18);
    }
    .bar p { margin: 0; font-size: 13px; line-height: 1.4; max-width: 42rem; }
    .bar strong { letter-spacing: 0.04em; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; }
    .actions button, .actions a {
      appearance: none;
      border: 0;
      border-radius: 8px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      color: #e30613;
      background: #fff;
    }
    .actions a.secondary {
      background: transparent;
      color: #fff;
      border: 1px solid rgba(255,255,255,0.55);
    }
    .frame { padding: 16px 12px 40px; }
    @media print {
      .bar { display: none !important; }
      body { background: #fff; }
      .frame { padding: 0; }
    }
  </style>
</head>
<body>
  <div class="bar">
    <p><strong>Save as PDF now</strong> — Print → Save as PDF / Print to PDF. During landfall you may be on your own with no signal.</p>
    <div class="actions">
      <button type="button" onclick="window.print()">Download PDF</button>
      <a class="secondary" href="#kit">Skip to kit</a>
    </div>
  </div>
  <div class="frame" id="kit">
    ${bodyInner}
  </div>
  <script>
    document.title = ${JSON.stringify(titleBase)};
    ${
      autoPrint
        ? `window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 450);
    });`
        : ""
    }
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, max-age=60",
      "X-LUWAS-Offline-Kit": template,
    },
  });
}
