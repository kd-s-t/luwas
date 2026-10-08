export type BrandedEmailParts = {
  subject: string;
  text: string;
  html: string;
};

const BRAND = "Luwas";
const ACCENT = "#1f8f55";
const INK = "#0f2a1c";
const MUTED = "#4d6b5a";
const CARD_BG = "#ffffff";
const OUTER_BG = "#e8f5ee";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export function mailFromDisplay(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Luwas Alerts <onboarding@resend.dev>"
  );
}

/** Shared Luwas transactional chrome: green header, white card, muted footer. */
export function buildBrandedEmail(params: {
  subject: string;
  eyebrow?: string;
  headline?: string;
  greetingName?: string;
  /** Header strip color (default Luwas green). Use danger/warn for alerts. */
  headerColor?: string;
  textBody: string;
  htmlBody: string;
  cta?: { label: string; url: string };
}): BrandedEmailParts {
  const greeting = params.greetingName?.trim();
  const textGreeting = greeting ? `Hi ${greeting},\n\n` : "";
  const htmlGreeting = greeting
    ? `<p style="margin:0 0 8px;font-size:16px;color:${INK};">Hi ${escapeHtml(greeting)},</p>`
    : "";
  const eyebrow = params.eyebrow?.trim();
  const headline = params.headline?.trim();
  const headerColor = params.headerColor?.trim() || ACCENT;
  const origin = appOrigin();

  let ctaText = "";
  let ctaHtml = "";
  if (params.cta?.url && params.cta.label) {
    ctaText = `\n\n${params.cta.label}: ${params.cta.url}`;
    ctaHtml = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background:${ACCENT};">
                          <a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(params.cta.label)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>`;
  }

  const footerText = `— ${BRAND}
Logistics & Unified Workflow for Aid & Safety
Brgy. Nangka MDRRMO · Consolacion, Cebu
${origin}`;

  const text = `${textGreeting}${params.textBody}${ctaText}

${footerText}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;min-height:100%;background:${OUTER_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;min-height:100%;border-collapse:collapse;background:${OUTER_BG};">
    <tr>
      <td align="center" style="padding:24px 12px;background:${OUTER_BG};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:610px;border-collapse:separate;border-spacing:0;border-radius:16px;box-shadow:0 4px 10px rgba(15,42,28,0.06),0 14px 36px rgba(15,42,28,0.12);">
          <tr>
            <td style="border-radius:16px;overflow:hidden;border:1px solid #b7d9c6;background:${CARD_BG};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${CARD_BG};">
                <tr>
                  <td align="center" style="background:${headerColor};padding:36px 28px 40px;">
                    <p style="margin:0;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${escapeHtml(BRAND)}</p>
                    <p style="margin:8px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Aid &amp; Safety</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:32px 28px;">
                    ${
                      eyebrow
                        ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;color:${ACCENT};text-align:center;">${escapeHtml(eyebrow)}</p>`
                        : ""
                    }
                    ${
                      headline
                        ? `<p style="margin:0 0 20px;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:${INK};text-align:center;">${escapeHtml(headline)}</p>`
                        : ""
                    }
                    ${htmlGreeting}
                    ${params.htmlBody}
                    ${ctaHtml}
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 28px 28px;border-top:1px solid #d8ebe0;background:#f4faf6;">
                    <p style="margin:0 0 4px;font-size:13px;font-weight:600;color:${INK};text-align:center;">${escapeHtml(BRAND)}</p>
                    <p style="margin:0 0 8px;font-size:12px;line-height:1.45;color:${MUTED};text-align:center;">Logistics &amp; Unified Workflow for Aid &amp; Safety</p>
                    <p style="margin:0;font-size:11px;line-height:1.45;color:${MUTED};text-align:center;">Brgy. Nangka MDRRMO · Consolacion, Cebu</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject: params.subject, text, html };
}
