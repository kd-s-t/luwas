export type BrandedEmailParts = {
  subject: string;
  text: string;
  html: string;
};

const BRAND = "LUWAS";
const ACCENT = "#c72929";
const INK = "#1f2126";
const MUTED = "#666e78";
const CARD_BG = "#ffffff";
const OUTER_BG = "#eef0f3";

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
    "LUWAS Alerts <onboarding@resend.dev>"
  );
}

const WARNING_RED = "#e30613";

/** Red hazard-tape WARNING banner (email-safe CSS stripes + SVG mark). */
function warningAlertHeaderHtml(): string {
  const stripe = `repeating-linear-gradient(-45deg,#ffffff 0,#ffffff 9px,${WARNING_RED} 9px,${WARNING_RED} 18px)`;
  // White triangle with red "!" — data URI for clients that block remote images.
  const mark =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><path fill="#ffffff" d="M24 4 2 42h44L24 4z"/><path fill="${WARNING_RED}" d="M22 18h4v12h-4zm0 16h4v4h-4z"/></svg>`,
    );

  return `
                <tr>
                  <td style="padding:0;background:${WARNING_RED};">
                    <div style="height:18px;line-height:18px;font-size:0;background:${stripe};">&nbsp;</div>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${WARNING_RED};">
                      <tr>
                        <td align="center" style="padding:26px 20px 22px;background:${WARNING_RED};">
                          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                            <tr>
                              <td valign="middle" style="padding:0 14px 0 0;">
                                <img src="${mark}" width="40" height="40" alt="" style="display:block;border:0;outline:none;" />
                              </td>
                              <td valign="middle">
                                <p style="margin:0;font-size:34px;line-height:1;font-weight:800;letter-spacing:0.12em;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">WARNING</p>
                              </td>
                            </tr>
                          </table>
                          <p style="margin:12px 0 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.92);font-family:Arial,Helvetica,sans-serif;">${escapeHtml(BRAND)} · Aid &amp; Safety</p>
                        </td>
                      </tr>
                    </table>
                    <div style="height:18px;line-height:18px;font-size:0;background:${stripe};">&nbsp;</div>
                  </td>
                </tr>`;
}

function brandHeaderHtml(headerColor: string): string {
  return `
                <tr>
                  <td align="center" style="background:${headerColor};padding:36px 28px 40px;">
                    <p style="margin:0;font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">${escapeHtml(BRAND)}</p>
                    <p style="margin:8px 0 0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Aid &amp; Safety</p>
                  </td>
                </tr>`;
}

/** Shared LUWAS transactional chrome: red header, white card, muted footer. */
export function buildBrandedEmail(params: {
  subject: string;
  eyebrow?: string;
  headline?: string;
  greetingName?: string;
  /** Header strip color (default LUWAS red). Ignored when headerVariant is warning. */
  headerColor?: string;
  /** `warning` = red hazard-tape WARNING banner for DRRM alerts. */
  headerVariant?: "brand" | "warning";
  textBody: string;
  htmlBody: string;
  cta?: { label: string; url: string };
  /** Optional second button under the primary CTA. */
  ctaSecondary?: { label: string; url: string };
}): BrandedEmailParts {
  const greeting = params.greetingName?.trim();
  const textGreeting = greeting ? `Hi ${greeting},\n\n` : "";
  const htmlGreeting = greeting
    ? `<p style="margin:0 0 8px;font-size:16px;color:${INK};">Hi ${escapeHtml(greeting)},</p>`
    : "";
  const eyebrow = params.eyebrow?.trim();
  const headline = params.headline?.trim();
  const isWarning = params.headerVariant === "warning";
  const headerColor = params.headerColor?.trim() || ACCENT;
  const cardBorder = isWarning ? "#f5a5a0" : "#dbe0e6";
  const outerBg = isWarning ? "#f7ecec" : OUTER_BG;
  const eyebrowColor = isWarning ? WARNING_RED : ACCENT;
  const origin = appOrigin();
  const headerHtml = isWarning
    ? warningAlertHeaderHtml()
    : brandHeaderHtml(headerColor);
  const primaryBtn = isWarning ? WARNING_RED : ACCENT;

  let ctaText = "";
  let ctaHtml = "";
  if (params.cta?.url && params.cta.label) {
    ctaText = `\n\n${params.cta.label}: ${params.cta.url}`;
    if (params.ctaSecondary?.url && params.ctaSecondary.label) {
      ctaText += `\n${params.ctaSecondary.label}: ${params.ctaSecondary.url}`;
    }
    const secondaryHtml =
      params.ctaSecondary?.url && params.ctaSecondary.label
        ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center">
                    <a href="${escapeHtml(params.ctaSecondary.url)}" style="display:inline-block;padding:12px 20px;font-size:14px;font-weight:600;color:${primaryBtn};text-decoration:underline;">${escapeHtml(params.ctaSecondary.label)}</a>
                  </td>
                </tr>
              </table>`
        : "";
    ctaHtml = `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 12px;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background:${primaryBtn};">
                          <a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${escapeHtml(params.cta.label)}</a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              ${secondaryHtml}`;
  }

  const footerText = `— ${BRAND}
Logistics & Unified Workflow for Aid & Safety
Brgy. Nangka MDRRMO · Consolacion, Cebu
${origin}`;

  const text = `${isWarning ? "⚠ WARNING\n\n" : ""}${textGreeting}${params.textBody}${ctaText}

${footerText}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(params.subject)}</title>
</head>
<body style="margin:0;padding:0;min-height:100%;background:${outerBg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;min-height:100%;border-collapse:collapse;background:${outerBg};">
    <tr>
      <td align="center" style="padding:24px 12px;background:${outerBg};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:610px;border-collapse:separate;border-spacing:0;border-radius:16px;box-shadow:0 4px 10px rgba(31, 33, 38,0.06),0 14px 36px rgba(31, 33, 38,0.12);">
          <tr>
            <td style="border-radius:16px;overflow:hidden;border:1px solid ${cardBorder};background:${CARD_BG};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:${CARD_BG};">
                ${headerHtml}
                <tr>
                  <td style="padding:32px 28px;">
                    ${
                      eyebrow
                        ? `<p style="margin:0 0 8px;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;font-weight:700;color:${eyebrowColor};text-align:center;">${escapeHtml(eyebrow)}</p>`
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
                  <td style="padding:20px 28px 28px;border-top:1px solid #e5e8ec;background:#f7f7fa;">
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
