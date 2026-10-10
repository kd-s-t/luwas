import { buildEvacSmsBody } from "@/lib/alerts/smsCopy";
import {
  formatDistanceKm,
  haversineKm,
} from "@/lib/email/alertMap";
import {
  DEFAULT_EMAIL_SAMPLE,
  type EmailSampleContext,
} from "@/lib/email/templates";
import type { TextTemplateId } from "@/lib/sms/registry";

export type TextParts = {
  body: string;
  /** Rough GSM-7 segment count (160 / 153). */
  segments: number;
};

function segmentCount(body: string): number {
  const len = body.length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

function parts(body: string): TextParts {
  return { body, segments: segmentCount(body) };
}

export function buildRegisterSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    `LUWAS: Hi ${ctx.name}, thanks for registering as a citizen of ${ctx.barangay}. ` +
      `Open the LUWAS app / site to verify your account and start receiving DRRM alerts.`,
  );
}

export function buildVerifiedSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    `LUWAS: ${ctx.name}, your account is verified. ` +
      `You will receive SMS alerts for ${ctx.barangay}, ${ctx.lgu}. Keep this number on.`,
  );
}

export function buildWelcomeSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    `LUWAS · Welcome ${ctx.name}. You're on the ${ctx.barangay} (${ctx.purok}) alert roster. ` +
      `We'll text evacuate / prepare / monitor guidance from MDRRMO. Reply STOP to opt out (demo).`,
  );
}

export function buildEqAlertSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  const eq = ctx.earthquake ?? DEFAULT_EMAIL_SAMPLE.earthquake!;
  const dist = formatDistanceKm(haversineKm(ctx.home, eq));
  const mag = `M${eq.magnitude.toFixed(1)}`;
  return parts(
    `LUWAS EQ ALERT · JUST NOW: ${mag} · ${dist} from your home (${ctx.purok}). ` +
      `Epicenter: ${eq.place}. Drop, Cover, Hold. Check damage before going outside. ` +
      `Follow barangay if told to evacuate.`,
  );
}

export function buildFireAlertSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  const fire = ctx.fire ?? DEFAULT_EMAIL_SAMPLE.fire!;
  const dist = formatDistanceKm(haversineKm(ctx.home, fire));
  return parts(
    `LUWAS FIRE ALERT · JUST NOW: ${fire.name} · ${dist} from your home (${ctx.purok}). ` +
      `${fire.place}. Move away from smoke/heat. Do not re-enter. Call BFP/barangay if you have info.`,
  );
}

export function buildTyphoonAlertSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    `LUWAS TYPHOON WATCH · ~3 DAYS: Storm approaching ${ctx.barangay}. ` +
      `Charge phone/flashlight/power bank now. Stock water/food/meds. ` +
      `Save the LUWAS email as PDF — during landfall you may be on your own. Good luck.`,
  );
}

export function buildEvacuateAlertSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    buildEvacSmsBody({
      ownerName: ctx.name,
      purok: ctx.purok,
      priority: "evacuate",
      barangay: ctx.barangay,
    }),
  );
}

export function buildPrepareAlertSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  return parts(
    buildEvacSmsBody({
      ownerName: ctx.name,
      purok: ctx.purok,
      priority: "prepare",
      barangay: ctx.barangay,
    }),
  );
}

export function buildReportVerifiedSms(
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  const report = ctx.report ?? DEFAULT_EMAIL_SAMPLE.report!;
  return parts(
    `LUWAS: Your report was verified — ${report.title} (${report.hazardLabel}) at ${report.place}. ` +
      `Ref ${report.id}. Salamat — this helps ${ctx.barangay} DRRM prioritize response.`,
  );
}

export function buildTextTemplate(
  id: TextTemplateId,
  ctx: EmailSampleContext = DEFAULT_EMAIL_SAMPLE,
): TextParts {
  switch (id) {
    case "register":
      return buildRegisterSms(ctx);
    case "verified":
      return buildVerifiedSms(ctx);
    case "welcome":
      return buildWelcomeSms(ctx);
    case "eq_alert":
      return buildEqAlertSms(ctx);
    case "fire_alert":
      return buildFireAlertSms(ctx);
    case "typhoon_alert":
      return buildTyphoonAlertSms(ctx);
    case "evacuate_alert":
      return buildEvacuateAlertSms(ctx);
    case "prepare_alert":
      return buildPrepareAlertSms(ctx);
    case "report_verified":
      return buildReportVerifiedSms(ctx);
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
