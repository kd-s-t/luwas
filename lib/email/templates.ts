import {
  alertDistanceMapHtml,
  formatDistanceKm,
  haversineKm,
} from "@/lib/email/alertMap";
import {
  appOrigin,
  buildBrandedEmail,
  escapeHtml,
  type BrandedEmailParts,
} from "@/lib/email/branded";
import type { EmailTemplateId } from "@/lib/email/registry";

export type EmailSampleContext = {
  name: string;
  email: string;
  phone: string;
  barangay: string;
  purok: string;
  lgu: string;
  /** Citizen household pin (map “you”) */
  home: { lat: number; lng: number };
  /** Preview / send payload for earthquake alerts */
  earthquake?: {
    magnitude: number;
    depthKm: number;
    place: string;
    lat: number;
    lng: number;
  };
  /** Preview / send payload for fire alerts */
  fire?: {
    name: string;
    place: string;
    lat: number;
    lng: number;
  };
};

export const DEFAULT_EMAIL_SAMPLE: EmailSampleContext = {
  name: "Ken Dan S. Tinio",
  email: "kendantinio@gmail.com",
  phone: "09606075119",
  barangay: "Brgy. Nangka",
  purok: "Purok 6",
  lgu: "Consolacion, Cebu",
  home: { lat: 10.36845, lng: 123.96605 },
  earthquake: {
    magnitude: 5.2,
    depthKm: 18,
    place: "12 km ENE of Carmen, Cebu",
    lat: 10.66,
    lng: 124.1,
  },
  fire: {
    name: "Electrical fire · downed line",
    place: "Purok Singko mid Access Road",
    lat: 10.3702,
    lng: 123.9635,
  },
};

const DANGER = "#c0392b";
const WARN = "#b8860b";

function p(html: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:#0f2a1c;">${html}</p>`;
}

function muted(html: string): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#4d6b5a;">${html}</p>`;
}

function bulletList(items: string[]): string {
  const lis = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;font-size:15px;line-height:1.45;color:#0f2a1c;">${item}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 20px;padding:0 0 0 20px;">${lis}</ul>`;
}

export function buildRegisterEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const verifyUrl = `${appOrigin()}/register/citizen?verify=preview`;
  return buildBrandedEmail({
    subject: "Verify your Luwas citizen account",
    eyebrow: "Registration",
    headline: "Confirm your email",
    greetingName: ctx.name,
    textBody: `Thanks for registering with Luwas for ${ctx.barangay}, ${ctx.lgu}.

Open this link to verify your email and finish setup:
${verifyUrl}

If you did not create this account, you can ignore this message.`,
    htmlBody: `
      ${p(`Thanks for registering with Luwas for <strong>${escapeHtml(ctx.barangay)}</strong>, ${escapeHtml(ctx.lgu)}.`)}
      ${p("Tap the button below to verify your email and finish setup.")}
      ${muted("If you did not create this account, you can ignore this message.")}
    `,
    cta: { label: "Verify email", url: verifyUrl },
  });
}

export function buildVerifiedEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const loginUrl = `${appOrigin()}/login/citizen`;
  return buildBrandedEmail({
    subject: "Your Luwas email is verified",
    eyebrow: "Account verified",
    headline: "You're confirmed",
    greetingName: ctx.name,
    textBody: `Your email ${ctx.email} is verified.

You can now sign in and receive barangay DRRM alerts for ${ctx.barangay}.

Sign in: ${loginUrl}`,
    htmlBody: `
      ${p(`Your email <strong>${escapeHtml(ctx.email)}</strong> is verified.`)}
      ${p(`You can now sign in and receive barangay DRRM alerts for <strong>${escapeHtml(ctx.barangay)}</strong>.`)}
    `,
    cta: { label: "Sign in", url: loginUrl },
  });
}

export function buildWelcomeEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const citizenUrl = `${appOrigin()}/citizen`;
  return buildBrandedEmail({
    subject: `Welcome to Luwas · ${ctx.barangay}`,
    eyebrow: "Welcome",
    headline: "You're on the roster",
    greetingName: ctx.name,
    textBody: `Welcome to Luwas.

Your citizen profile is ready for ${ctx.barangay} (${ctx.purok}).
We'll send SMS and email when MDRRMO issues evacuate / prepare / monitor guidance.

Mobile on file: ${ctx.phone}

Open your citizen hub: ${citizenUrl}`,
    htmlBody: `
      ${p("Your citizen profile is ready. We'll send SMS and email when MDRRMO issues evacuate, prepare, or monitor guidance.")}
      ${bulletList([
        `<strong>Barangay:</strong> ${escapeHtml(ctx.barangay)}, ${escapeHtml(ctx.lgu)}`,
        `<strong>Purok:</strong> ${escapeHtml(ctx.purok)}`,
        `<strong>Mobile:</strong> ${escapeHtml(ctx.phone)}`,
      ])}
      ${muted("Keep your contact details current so alerts reach you in time.")}
    `,
    cta: { label: "Open citizen hub", url: citizenUrl },
  });
}

export function buildEqAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  const when = "just now";
  const eq = ctx.earthquake ?? DEFAULT_EMAIL_SAMPLE.earthquake!;
  const home = ctx.home;
  const magLabel = `M${eq.magnitude.toFixed(1)}`;
  const distanceKm = haversineKm(home, eq);
  const distLabel = formatDistanceKm(distanceKm);
  const homePoint = {
    ...home,
    label: `${ctx.purok} · ${ctx.barangay}`,
  };
  const hazPoint = { lat: eq.lat, lng: eq.lng, label: eq.place };
  const mapBlock = alertDistanceMapHtml({
    home: homePoint,
    hazard: hazPoint,
    kind: "eq",
    distanceKm,
  });

  return buildBrandedEmail({
    subject: `LUWAS · EARTHQUAKE ${magLabel} · ${distLabel} away`,
    eyebrow: "Earthquake · Immediate",
    headline: `${magLabel} tremor detected`,
    headerColor: DANGER,
    greetingName: ctx.name,
    textBody: `EARTHQUAKE ALERT — ${when}

Magnitude: ${magLabel}
Depth: ${eq.depthKm} km
Distance from your home (${ctx.purok}): ${distLabel}
Epicenter: ${eq.place}

A ${magLabel} earthquake was felt / reported ${distLabel} from your location in ${ctx.barangay}, ${ctx.lgu}.

Drop, Cover, Hold. Stay clear of glass and unsecured shelves.
Check for injuries and structural damage before moving outdoors.
Follow barangay instructions if evacuation is ordered.

Situation map: ${mapUrl}`,
    htmlBody: `
      ${p(`<strong>Happened ${escapeHtml(when)}.</strong> A <strong>${escapeHtml(magLabel)}</strong> earthquake is <strong>${escapeHtml(distLabel)}</strong> from your home in <strong>${escapeHtml(ctx.barangay)}</strong>.`)}
      ${mapBlock}
      ${bulletList([
        `<strong>Magnitude:</strong> ${escapeHtml(magLabel)}`,
        `<strong>Depth:</strong> ${eq.depthKm} km`,
        `<strong>From you:</strong> ${escapeHtml(distLabel)}`,
        `<strong>Epicenter:</strong> ${escapeHtml(eq.place)}`,
      ])}
      ${bulletList([
        "<strong>Drop, Cover, Hold</strong> until shaking stops.",
        "Stay clear of glass, cabinets, and unsecured shelves.",
        "Check for injuries and structural damage before going outside.",
        "Follow barangay instructions if evacuation is ordered.",
      ])}
      ${muted("Source: USGS feed · distance measured to your household pin.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

export function buildFireAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  const when = "just now";
  const fire = ctx.fire ?? DEFAULT_EMAIL_SAMPLE.fire!;
  const home = ctx.home;
  const distanceKm = haversineKm(home, fire);
  const distLabel = formatDistanceKm(distanceKm);
  const homePoint = {
    ...home,
    label: `${ctx.purok} · ${ctx.barangay}`,
  };
  const hazPoint = {
    lat: fire.lat,
    lng: fire.lng,
    label: `${fire.name} · ${fire.place}`,
  };
  const mapBlock = alertDistanceMapHtml({
    home: homePoint,
    hazard: hazPoint,
    kind: "fire",
    distanceKm,
  });

  return buildBrandedEmail({
    subject: `LUWAS · FIRE ALERT · ${distLabel} from you`,
    eyebrow: "Fire · Immediate",
    headline: "Fire reported nearby",
    headerColor: DANGER,
    greetingName: ctx.name,
    textBody: `FIRE ALERT — ${when}

${fire.name}
Location: ${fire.place}
Distance from your home (${ctx.purok}): ${distLabel}

A fire was reported ${distLabel} from your location in ${ctx.barangay}, ${ctx.lgu}.

Move away from smoke and heat. Do not re-enter burning structures.
Call BFP / barangay responders if you have new information.
Keep exits clear and prepare to evacuate if directed.

Situation map: ${mapUrl}`,
    htmlBody: `
      ${p(`<strong>Happened ${escapeHtml(when)}.</strong> <strong>${escapeHtml(fire.name)}</strong> is <strong>${escapeHtml(distLabel)}</strong> from your home.`)}
      ${mapBlock}
      ${bulletList([
        `<strong>From you:</strong> ${escapeHtml(distLabel)}`,
        `<strong>Place:</strong> ${escapeHtml(fire.place)}`,
      ])}
      ${bulletList([
        "Move away from smoke and heat immediately.",
        "Do not re-enter burning structures.",
        "Call BFP / barangay responders with any new information.",
        "Keep exits clear and prepare to evacuate if directed.",
      ])}
      ${muted("Distance measured to your household pin · Luwas DRRM alert.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

export function buildTyphoonAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  return buildBrandedEmail({
    subject: `LUWAS · TYPHOON WATCH · ${ctx.barangay} · ~3 days`,
    eyebrow: "Typhoon · ~3 days out",
    headline: "Storm approaching",
    headerColor: WARN,
    greetingName: ctx.name,
    textBody: `TYPHOON ALERT — about 3 days before estimated landfall / closest approach.

Track guidance for ${ctx.barangay}, ${ctx.lgu}:
• Stock drinking water, ready-to-eat food (3 days), medicines, power bank, flashlight, and cooking fuel.
• Secure roofs, windows, and outdoor items.
• Know your escape direction to high ground / evacuation center if floods threaten ${ctx.purok}.
• Monitor Luwas and PAGASA updates — do not wait for the last minute.

Situation map: ${mapUrl}`,
    htmlBody: `
      ${p(`<strong>About 3 days</strong> before estimated landfall / closest approach to Consolacion.`)}
      ${p(`Prepare now for <strong>${escapeHtml(ctx.barangay)}</strong> (${escapeHtml(ctx.purok)}):`)}
      ${bulletList([
        "Stock drinking water, ready-to-eat food (3 days), medicines, power bank, flashlight, and cooking fuel.",
        "Secure roofs, windows, and outdoor items.",
        "Know your escape direction to high ground / evacuation center if floods threaten your purok.",
        "Monitor Luwas and PAGASA updates — do not wait for the last minute.",
      ])}
      ${muted("Advance warning so households can prepare before the storm window.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

export function buildEmailTemplate(
  id: EmailTemplateId,
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  switch (id) {
    case "register":
      return buildRegisterEmail(ctx);
    case "verified":
      return buildVerifiedEmail(ctx);
    case "welcome":
      return buildWelcomeEmail(ctx);
    case "eq_alert":
      return buildEqAlertEmail(ctx);
    case "fire_alert":
      return buildFireAlertEmail(ctx);
    case "typhoon_alert":
      return buildTyphoonAlertEmail(ctx);
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
