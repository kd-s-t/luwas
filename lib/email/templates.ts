import {
  alertDistanceMapHtml,
  formatDistanceKm,
  haversineKm,
  shelterOptionsMapHtml,
  type ShelterDest,
} from "@/lib/email/alertMap";
import {
  appOrigin,
  buildBrandedEmail,
  escapeHtml,
  type BrandedEmailParts,
} from "@/lib/email/branded";
import type { EmailTemplateId } from "@/lib/email/registry";
import {
  CEBU_EVAC_CENTERS,
  NANGKA_ROUTE_EVAC_CENTERS,
} from "@/lib/geo/cebuEvacCenters";
import {
  bfpForBarangay,
  phoneToTelHref,
  respondersForBarangay,
  stationPhoneList,
  type ResponderStation,
} from "@/lib/geo/responderStations";

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
  /** Preview / send payload when a field report is verified */
  report?: {
    id: string;
    title: string;
    hazardLabel: string;
    place: string;
    notes?: string;
  };
};

export const DEFAULT_EMAIL_SAMPLE: EmailSampleContext = {
  name: "Ken Dan S. Tinio",
  email: "kendantinio@gmail.com",
  phone: "09171234567",
  barangay: "Brgy. Nangka",
  purok: "Purok 6",
  lgu: "Consolacion, Cebu",
  home: { lat: 10.369166, lng: 123.962317 },
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
  report: {
    id: "rpt-flood-nangka-01",
    title: "Knee-deep flood on Access Road",
    hazardLabel: "Flood",
    place: "Purok 6 · Access Road near chapel",
    notes: "Water rising toward homes · vehicles stalled",
  },
};

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

function phoneLinksHtml(phones: string[]): string {
  if (phones.length === 0) {
    return `<a href="tel:911" style="color:#1f8f55;text-decoration:underline;">911</a>`;
  }
  return phones
    .map(
      (ph) =>
        `<a href="${phoneToTelHref(ph)}" style="color:#1f8f55;text-decoration:underline;">${escapeHtml(ph)}</a>`,
    )
    .join(" · ");
}

/** Nearby BFP station + numbers for fire / EQ alert emails. */
function nearbyBfpCopy(ctx: EmailSampleContext): {
  textBlock: string;
  htmlBlock: string;
  callLine: string;
} {
  const station = bfpForBarangay(ctx.lgu, ctx.barangay);
  const phones = station ? stationPhoneList(station) : [];
  const name = station?.name.replace(/\s*\(BFP\)\s*$/i, "").trim() || "BFP";
  const phoneLabel =
    phones.length > 0 ? phones.join(" · ") : "911 (national emergency)";
  const textBlock = `Nearby fire station: ${name}
Call: ${phoneLabel}
Or dial 911 for life-threatening emergencies.`;
  const htmlBlock = `
      <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#f3faf6;border:1px solid #cfe8d9;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#4d6b5a;font-weight:600;">Nearby fire station</p>
        <p style="margin:0 0 8px;font-size:16px;line-height:1.45;color:#0f2a1c;font-weight:600;">${escapeHtml(name)}</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#0f2a1c;">Call ${phoneLinksHtml(phones)}</p>
        <p style="margin:8px 0 0;font-size:13px;line-height:1.45;color:#4d6b5a;">Or dial 911 for life-threatening emergencies.</p>
      </div>`;
  const callLine = `Call ${name}: ${phoneLabel} (or 911).`;
  return { textBlock, htmlBlock, callLine };
}

type CallRow = { role: string; name: string; phones: string[] };

function pickStation(
  list: ResponderStation[],
  kind: ResponderStation["kind"],
  prefer?: (s: ResponderStation) => boolean,
): ResponderStation | undefined {
  const ofKind = list.filter((s) => s.kind === kind);
  const withPhones = ofKind.filter((s) => stationPhoneList(s).length > 0);
  const pool = withPhones.length ? withPhones : ofKind;
  if (prefer) {
    const hit = pool.find(prefer);
    if (hit) return hit;
  }
  return pool[0];
}

/** BFP, police, barangay hall, hospital — offline-ready call card. */
function nearbyEmergencyContacts(ctx: EmailSampleContext): {
  rows: CallRow[];
  textBlock: string;
  htmlBlock: string;
} {
  const list = respondersForBarangay(ctx.lgu, ctx.barangay);
  const bfp = pickStation(list, "bfp");
  const police = pickStation(list, "pnp");
  const hall = pickStation(list, "tanod");
  const hospital = pickStation(
    list,
    "hospital",
    (s) => /medical center|hospital/i.test(s.name),
  );

  const rows: CallRow[] = [];
  if (bfp) {
    rows.push({
      role: "Fire (BFP)",
      name: bfp.name.replace(/\s*\(BFP\)\s*$/i, "").trim(),
      phones: stationPhoneList(bfp).slice(0, 3),
    });
  }
  if (police) {
    rows.push({
      role: "Police (PNP)",
      name: police.name,
      phones: stationPhoneList(police).slice(0, 3),
    });
  }
  if (hall) {
    rows.push({
      role: "Barangay hall",
      name: /hall/i.test(hall.name)
        ? hall.name
        : `${ctx.barangay.replace(/^Brgy\.?\s*/i, "").trim()} Barangay Hall`,
      phones: stationPhoneList(hall).slice(0, 3),
    });
  }
  if (hospital) {
    rows.push({
      role: "Hospital",
      name: hospital.name,
      phones: stationPhoneList(hospital).slice(0, 3),
    });
  }

  const textLines = rows.map((r) => {
    const phones =
      r.phones.length > 0 ? r.phones.join(" · ") : "911";
    return `• ${r.role}: ${r.name} — ${phones}`;
  });
  const textBlock = `Who to call nearby (save these before landfall):
${textLines.join("\n")}
• National emergency: 911`;

  const htmlRows = rows
    .map(
      (r) => `
        <tr>
          <td valign="top" style="padding:10px 0;border-top:1px solid #d7ebe0;">
            <p style="margin:0 0 2px;font-size:11px;letter-spacing:0.06em;text-transform:uppercase;font-weight:700;color:#4d6b5a;">${escapeHtml(r.role)}</p>
            <p style="margin:0 0 4px;font-size:15px;line-height:1.35;font-weight:600;color:#0f2a1c;">${escapeHtml(r.name)}</p>
            <p style="margin:0;font-size:15px;line-height:1.45;color:#0f2a1c;">${phoneLinksHtml(r.phones)}</p>
          </td>
        </tr>`,
    )
    .join("");

  const htmlBlock = `
      <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#f3faf6;border:1px solid #cfe8d9;">
        <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#4d6b5a;font-weight:600;">Who to call nearby</p>
        <p style="margin:0 0 8px;font-size:13px;line-height:1.45;color:#4d6b5a;">Save these numbers offline before landfall.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          ${htmlRows}
          <tr>
            <td style="padding:10px 0 0;border-top:1px solid #d7ebe0;">
              <p style="margin:0;font-size:14px;line-height:1.45;color:#0f2a1c;">Life-threatening: <a href="tel:911" style="color:#1f8f55;text-decoration:underline;font-weight:700;">911</a></p>
            </td>
          </tr>
        </table>
      </div>`;

  return { rows, textBlock, htmlBlock };
}

function shelterDestinationsFor(ctx: EmailSampleContext): ShelterDest[] {
  const home = ctx.home;
  const lguHead = ctx.lgu.split(",")[0]?.trim().toLowerCase() || "";
  const brgy = ctx.barangay.replace(/^(brgy\.?|barangay)\s+/i, "").trim();
  const isNangkaOps =
    /nangka/i.test(brgy) || /consolacion/i.test(lguHead);

  const catalog = isNangkaOps
    ? NANGKA_ROUTE_EVAC_CENTERS
    : CEBU_EVAC_CENTERS.filter(
        (e) => e.lgu.toLowerCase() === lguHead,
      ).slice(0, 5);

  const source =
    catalog.length > 0 ? catalog : NANGKA_ROUTE_EVAC_CENTERS;

  return source
    .map((e) => ({
      lat: e.lat,
      lng: e.lng,
      label: e.name,
      distanceKm: haversineKm(home, e),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function buildRegisterEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const verifyUrl = `${appOrigin()}/register/citizen?verify=preview`;
  return buildBrandedEmail({
    subject: "Verify your LUWAS citizen account",
    eyebrow: "Registration",
    headline: "Confirm your email",
    greetingName: ctx.name,
    textBody: `Thanks for registering with LUWAS for ${ctx.barangay}, ${ctx.lgu}.

Open this link to verify your email and finish setup:
${verifyUrl}

If you did not create this account, you can ignore this message.`,
    htmlBody: `
      ${p(`Thanks for registering with LUWAS for <strong>${escapeHtml(ctx.barangay)}</strong>, ${escapeHtml(ctx.lgu)}.`)}
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
    subject: "Your LUWAS email is verified",
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
    subject: `Welcome to LUWAS · ${ctx.barangay}`,
    eyebrow: "Welcome",
    headline: "You're on the roster",
    greetingName: ctx.name,
    textBody: `Welcome to LUWAS.

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
  const bfp = nearbyBfpCopy(ctx);

  return buildBrandedEmail({
    subject: `LUWAS · EARTHQUAKE ${magLabel} · ${distLabel} away`,
    eyebrow: "Earthquake · Immediate",
    headline: `${magLabel} tremor detected`,
    headerVariant: "warning",
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

${bfp.textBlock}

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
      ${bfp.htmlBlock}
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
  const bfp = nearbyBfpCopy(ctx);

  return buildBrandedEmail({
    subject: `LUWAS · FIRE ALERT · ${distLabel} from you`,
    eyebrow: "Fire · Immediate",
    headline: "Fire reported nearby",
    headerVariant: "warning",
    greetingName: ctx.name,
    textBody: `FIRE ALERT — ${when}

${fire.name}
Location: ${fire.place}
Distance from your home (${ctx.purok}): ${distLabel}

A fire was reported ${distLabel} from your location in ${ctx.barangay}, ${ctx.lgu}.

Move away from smoke and heat. Do not re-enter burning structures.
${bfp.callLine}
Keep exits clear and prepare to evacuate if directed.

${bfp.textBlock}

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
        escapeHtml(bfp.callLine),
        "Keep exits clear and prepare to evacuate if directed.",
      ])}
      ${bfp.htmlBlock}
      ${muted("Distance measured to your household pin · LUWAS DRRM alert.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

export function buildTyphoonAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  const offlinePdfUrl = `${appOrigin()}/api/email/offline-kit?template=typhoon_alert`;
  const homePoint = {
    ...ctx.home,
    label: `${ctx.purok} · ${ctx.barangay}`,
  };
  const destinations = shelterDestinationsFor(ctx);
  const mapBlock = shelterOptionsMapHtml({
    home: homePoint,
    destinations,
  });
  const contacts = nearbyEmergencyContacts(ctx);
  const destText = destinations
    .map(
      (d, i) =>
        `${i + 1}. ${d.label} — ${formatDistanceKm(d.distanceKm)} from your home`,
    )
    .join("\n");

  return buildBrandedEmail({
    subject: `LUWAS · TYPHOON WATCH · ${ctx.barangay} · ~3 days`,
    eyebrow: "Typhoon · ~3 days out",
    headline: "Storm approaching",
    headerVariant: "warning",
    greetingName: ctx.name,
    textBody: `TYPHOON ALERT — about 3 days before estimated landfall / closest approach.

Track guidance for ${ctx.barangay}, ${ctx.lgu}:
• Charge your phone fully. Charge flashlights, power banks, and rechargeable batteries now — while power is still up.
• Stock drinking water, ready-to-eat food (3 days), medicines, cooking fuel, and cash.
• Secure roofs, windows, and outdoor items.
• Download / save a PDF of this email while you still have signal. During landfall you may be on your own — no network, no LUWAS, no live map.
• Monitor LUWAS and PAGASA updates — do not wait for the last minute.

Where to evacuate (distance from your home in ${ctx.purok}):
${destText}

${contacts.textBlock}

Download offline PDF (Print → Save as PDF): ${offlinePdfUrl}
Situation map: ${mapUrl}

Good luck — and hope you survive.
LUWAS · Brgy. Nangka MDRRMO`,
    htmlBody: `
      ${p(`<strong>About 3 days</strong> before estimated landfall / closest approach to Consolacion.`)}
      ${p(`Prepare now for <strong>${escapeHtml(ctx.barangay)}</strong> (${escapeHtml(ctx.purok)}).`)}
      ${mapBlock}
      ${contacts.htmlBlock}
      <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#fff7ed;border:1px solid #fdba74;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#9a3412;font-weight:700;">Power &amp; light — do this today</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#0f2a1c;">Charge your <strong>phone</strong>, <strong>flashlights</strong>, <strong>power banks</strong>, and <strong>rechargeable batteries</strong> while electricity is still up. Keep spare cells dry in a sealed bag.</p>
      </div>
      <div style="margin:0 0 20px;padding:14px 16px;border-radius:10px;background:#fef2f2;border:1px solid #fecaca;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#991b1b;font-weight:700;">Save this offline</p>
        <p style="margin:0;font-size:15px;line-height:1.5;color:#0f2a1c;"><strong>Download a PDF of this email now</strong> (tap the button below → Print → Save as PDF). During landfall you may be on your own — no signal, no LUWAS, no live map. Paper or offline PDF is what you will have.</p>
      </div>
      ${bulletList([
        "Stock drinking water, ready-to-eat food (3 days), medicines, cooking fuel, and some cash.",
        "Secure roofs, windows, and outdoor items.",
        "Know your numbered escape options and call numbers above if floods threaten your purok.",
        "Monitor LUWAS and PAGASA updates — do not wait for the last minute.",
      ])}
      ${p("<strong>Good luck — and hope you survive.</strong>")}
      ${muted("Advance warning so households can prepare before the storm window.")}
    `,
    cta: { label: "Download offline PDF", url: offlinePdfUrl },
    ctaSecondary: { label: "Open situation map", url: mapUrl },
  });
}

/** Branded email for MDRRMO “alert them to evacuate” blast — not SMS text. */
export function buildEvacuateAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  const place = ctx.purok ? ` (${ctx.purok})` : "";
  return buildBrandedEmail({
    subject: `LUWAS ALERT · ${ctx.barangay} · EVACUATE NOW`,
    eyebrow: "Evacuate · Immediate",
    headline: "Evacuate now",
    headerVariant: "warning",
    greetingName: ctx.name,
    textBody: `EVACUATE NOW — ${ctx.barangay}${place}

Please evacuate immediately to Consolacion Evacuation Center, Evacuation Center 2, or Nangka Elementary.

• Follow road escape routes on the LUWAS situation map.
• Bring go-bag, IDs, medicines, drinking water, and ready-to-eat food.
• Do not wait for flood water to rise further.
• For life-threatening emergencies call local PNP / BFP / barangay.

Situation map: ${mapUrl}

Guidance for responders · Odette DRRM simulation.`,
    htmlBody: `
      ${p(`<strong>Evacuate now</strong> from <strong>${escapeHtml(ctx.barangay)}</strong>${place ? ` · ${escapeHtml(ctx.purok)}` : ""}.`)}
      ${p("Go to <strong>Consolacion Evacuation Center</strong>, <strong>Evacuation Center 2</strong>, or <strong>Nangka Elementary</strong>.")}
      ${bulletList([
        "Follow road escape routes on the LUWAS situation map.",
        "Bring go-bag, IDs, medicines, drinking water, and ready-to-eat food.",
        "Do not wait for flood water to rise further.",
        "For life-threatening emergencies call local PNP / BFP / barangay.",
      ])}
      ${muted("Guidance for responders · Odette DRRM simulation.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

/** Branded email for prepare / shelter-in-place blast. */
export function buildPrepareAlertEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const mapUrl = `${appOrigin()}/command`;
  const place = ctx.purok ? ` (${ctx.purok})` : "";
  return buildBrandedEmail({
    subject: `LUWAS ALERT · ${ctx.barangay} · PREPARE`,
    eyebrow: "Prepare · Shelter in place",
    headline: "Prepare and stock up",
    headerVariant: "warning",
    greetingName: ctx.name,
    textBody: `PREPARE — ${ctx.barangay}${place}

Barangay advises shelter in place on higher ground. Start stocking now:

• Drinking water and ready-to-eat food (3 days)
• Cooking fuel / fire source, medicines, power bank, flashlight
• Secure roofs, windows, and outdoor items
• Watch flood / wind updates — evacuate only if barangay directs

Situation map: ${mapUrl}

Guidance for responders · Odette DRRM simulation.`,
    htmlBody: `
      ${p(`<strong>Prepare now</strong> for <strong>${escapeHtml(ctx.barangay)}</strong>${place ? ` · ${escapeHtml(ctx.purok)}` : ""}.`)}
      ${p("Shelter in place on higher ground unless barangay tells you to evacuate.")}
      ${bulletList([
        "Stock drinking water and ready-to-eat food (3 days).",
        "Have cooking fuel, medicines, power bank, and flashlight ready.",
        "Secure roofs, windows, and outdoor items.",
        "Watch flood / wind updates — move only if barangay directs.",
      ])}
      ${muted("Guidance for responders · Odette DRRM simulation.")}
    `,
    cta: { label: "Open situation map", url: mapUrl },
  });
}

export function buildReportVerifiedEmail(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): BrandedEmailParts {
  const report = ctx.report ?? DEFAULT_EMAIL_SAMPLE.report!;
  const mapUrl = `${appOrigin()}/`;
  const notes = report.notes?.trim();

  return buildBrandedEmail({
    subject: `LUWAS · Report verified · ${report.title}`,
    eyebrow: "Field report · Verified",
    headline: "Your report was verified",
    greetingName: ctx.name,
    textBody: `Your field report was verified by ${ctx.barangay} DRRM.

Report: ${report.title}
Hazard: ${report.hazardLabel}
Place: ${report.place}
${notes ? `Notes: ${notes}\n` : ""}Reference: ${report.id}

Thank you — verified reports help officers prioritize response on the situation map.

Open map: ${mapUrl}`,
    htmlBody: `
      ${p(`Your field report was <strong>verified</strong> by <strong>${escapeHtml(ctx.barangay)}</strong> DRRM.`)}
      ${bulletList([
        `<strong>Report:</strong> ${escapeHtml(report.title)}`,
        `<strong>Hazard:</strong> ${escapeHtml(report.hazardLabel)}`,
        `<strong>Place:</strong> ${escapeHtml(report.place)}`,
        ...(notes ? [`<strong>Notes:</strong> ${escapeHtml(notes)}`] : []),
        `<strong>Reference:</strong> ${escapeHtml(report.id)}`,
      ])}
      ${p("Thank you — verified reports help officers prioritize response on the situation map.")}
      ${muted("You will get separate alerts if evacuate / prepare guidance is issued for your area.")}
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
    case "evacuate_alert":
      return buildEvacuateAlertEmail(ctx);
    case "prepare_alert":
      return buildPrepareAlertEmail(ctx);
    case "report_verified":
      return buildReportVerifiedEmail(ctx);
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
