import {
  autoResponderRouteForHazard,
  looksLikeFire,
} from "@/lib/alerts/autoResponderCall";
import {
  resolveResponderCalls,
  responderKindLabel,
} from "@/lib/alerts/responderCall";
import type { HazardReport } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";

export type IncidentUnknown = {
  id: string;
  label: string;
  detail: string;
};

export type IncidentProposal = {
  id: string;
  label: string;
  detail: string;
  /** Already completed (e.g. investigator assigned). */
  done?: boolean;
  /** Officer can toggle this checkbox themselves. */
  manual?: boolean;
  /** Small brand mark (e.g. Twilio for call/SMS outreach). */
  brand?: "twilio";
};

export type ActivityEvent = {
  id: string;
  at: string;
  kind: "citizen" | "ai" | "human" | "system";
  title: string;
  detail?: string;
};

/** Gaps the AI must not invent — surface for human follow-up. */
export function unknownsForReport(report: HazardReport): IncidentUnknown[] {
  const out: IncidentUnknown[] = [];

  if (report.lat == null || report.lng == null) {
    out.push({
      id: "location",
      label: "Location not sufficiently identified",
      detail:
        "Ask the reporter for a landmark, purok, or GPS pin before dispatch. Do not invent coordinates.",
    });
  } else if (
    report.locationAccuracyM != null &&
    report.locationAccuracyM > 80
  ) {
    out.push({
      id: "accuracy",
      label: "Location accuracy is coarse",
      detail: `GPS accuracy ~${Math.round(report.locationAccuracyM)} m — confirm with the resident before routing teams.`,
    });
  }

  if (!report.notes.trim()) {
    out.push({
      id: "notes",
      label: "Need details incomplete",
      detail: "No free-text need description. Confirm people at risk and assistance requested.",
    });
  }

  if (report.status === "needs_review" || report.aiVerdict === "needs_review") {
    out.push({
      id: "review",
      label: "AI flagged for human review",
      detail: report.aiReason ?? "Unclear media or text — verify before acting.",
    });
  }

  if (report.aiConfidence != null && report.aiConfidence < 0.55) {
    out.push({
      id: "confidence",
      label: "Low AI confidence",
      detail: `Model confidence ${Math.round(report.aiConfidence * 100)}% — treat as proposal only.`,
    });
  }

  return out;
}

/** Explainable next-step drafts — never authorized until an officer records a plan. */
export function proposalsForReport(report: HazardReport): IncidentProposal[] {
  const hazard = hazardHintLabel(report.hazardHint);
  const fireLike =
    report.hazardHint === "fire" ||
    looksLikeFire(
      report.title,
      report.notes,
      report.voiceTranscript,
      report.aiReason,
    );
  const effectiveHint = fireLike ? ("fire" as const) : report.hazardHint;
  const base: IncidentProposal[] = [
    {
      id: "contact",
      label: "Contact reporter to verify",
      detail: `Confirm ${hazard.toLowerCase()} conditions, people at risk, and exact access point with ${report.citizenName}.`,
    },
  ];

  if (report.hazardHint === "flood" || report.hazardHint === "typhoon") {
    base.push({
      id: "welfare",
      label: "Check vulnerable residents nearby",
      detail:
        "AI proposal: prioritize seniors, PWDs, and households that have not confirmed evacuation. Not an authorized rescue order.",
    });
  }

  if (report.lat != null && report.lng != null) {
    const assigned = Boolean(report.investigatorUid);
    const who = report.investigatorName || "investigator";
    base.push({
      id: "assign",
      label: "Assign field verification",
      detail: assigned
        ? `Assigned to ${who}. They go on-site and mark verified from their phone.`
        : "AI proposal: assign an officer to go on-site, confirm what happened, and mark field-verified from their phone.",
      done: assigned,
    });

    const fieldVerified =
      report.status === "legit" ||
      report.status === "dispatched" ||
      report.status === "done";
    base.push({
      id: "field_verify",
      label: "Mark field-verified",
      detail: fieldVerified
        ? `${who} confirmed on-site.`
        : assigned
          ? `${who} checks the scene on their phone, then taps Mark field-verified.`
          : "After assignment, the investigator confirms on-site from their phone before any dispatch.",
      done: fieldVerified,
    });
  } else {
    base.push({
      id: "locate",
      label: "Request missing location",
      detail:
        "Ask for purok / landmark first. Do not publish escape routes or aid ETAs until location is verified.",
    });
  }

  const route = autoResponderRouteForHazard(
    effectiveHint,
    report.title,
    report.notes,
    [report.voiceTranscript, report.aiReason].filter(Boolean).join(" "),
  );
  if (route) {
    const dials = resolveResponderCalls({
      lgu: report.lgu || "Consolacion",
      barangay: report.barangay || "Nangka",
      kinds: route.kinds,
      near:
        report.lat != null && report.lng != null
          ? { lat: report.lat, lng: report.lng }
          : null,
    });
    const log = report.dispatchLog;
    const outreachDone = Boolean(
      report.autoResponderCallAt ||
        (log && (log.called.length > 0 || log.texted.length > 0)),
    );
    for (const dial of dials) {
      const kindLabel = responderKindLabel(dial.kind);
      const shortName =
        dial.kind === "bfp"
          ? "BFP"
          : dial.kind === "pnp"
            ? "PNP"
            : dial.kind === "hospital"
              ? "Hospital"
              : "Tanod";
      base.push({
        id: `alert-${dial.kind}`,
        label: outreachDone
          ? `Called & texted ${shortName} · ${dial.phoneDisplay}`
          : `Call & text ${shortName} · ${dial.phoneDisplay}`,
        detail: outreachDone
          ? [
              `${dial.stationName} · ${kindLabel}`,
              log?.summary || "Auto-sent after field-verified.",
              log?.called?.length
                ? `Called: ${log.called.join(", ")}`
                : null,
              log?.texted?.length
                ? `Texted: ${log.texted.join(", ")}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : `After Mark field-verified: voice + SMS to ${dial.stationName} at ${dial.phoneDisplay}.`,
        done: outreachDone,
        brand: "twilio",
      });
    }
  }

  const dispatched =
    Boolean(report.manualDispatchChecked) ||
    report.status === "dispatched" ||
    report.status === "done";
  base.push({
    id: "dispatch",
    label: "Dispatch someone",
    detail: dispatched
      ? "Marked dispatched · auto-dispatch ran."
      : "Check to mark dispatched, then auto-dispatch runs.",
    done: dispatched,
    manual: true,
  });

  return base;
}

export function activityForReport(report: HazardReport): ActivityEvent[] {
  const events: ActivityEvent[] = [
    {
      id: `${report.id}-received`,
      at: report.createdAt,
      kind: "citizen",
      title: "Citizen report received",
      detail: `${report.title} · ${report.mediaSource === "mobile-camera" ? "field camera" : report.mediaSource === "desktop-file" ? "relay upload" : "in-app"}`,
    },
  ];

  if (report.status === "validating") {
    events.push({
      id: `${report.id}-validating`,
      at: report.updatedAt,
      kind: "ai",
      title: "AI processing",
      detail: "Extracting signals and checking media legitimacy…",
    });
  }

  if (report.aiVerdict && report.validatedAt) {
    const via = report.aiSource === "gemini" ? "Gemini" : report.aiSource ?? "AI";
    events.push({
      id: `${report.id}-ai`,
      at: report.validatedAt,
      kind: "ai",
      title: `AI proposal · ${report.aiVerdict.replace(/_/g, " ")}`,
      detail: [
        report.aiConfidence != null
          ? `${Math.round(report.aiConfidence * 100)}% via ${via}`
          : `via ${via}`,
        report.aiReason,
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  if (report.aiReason?.includes("Officer override")) {
    events.push({
      id: `${report.id}-override`,
      at: report.validatedAt ?? report.updatedAt,
      kind: "human",
      title: "Officer recorded verification decision",
      detail: report.aiReason,
    });
  } else if (report.status === "legit" && report.validatedAt) {
    events.push({
      id: `${report.id}-status`,
      at: report.validatedAt,
      kind: "system",
      title: "Status · queued as AI-legit (pending authorized plan)",
      detail: "Not an authorized response plan. Confirm needs and allocate only from real inventory.",
    });
  } else if (report.status === "rejected" && report.validatedAt) {
    events.push({
      id: `${report.id}-rejected`,
      at: report.validatedAt,
      kind: "system",
      title: "Status · rejected",
      detail: report.aiReason ?? undefined,
    });
  }

  if (report.dispatchLog) {
    const log = report.dispatchLog;
    if (log.called.length > 0) {
      events.push({
        id: `${report.id}-call`,
        at: log.at || report.autoResponderCallAt || report.updatedAt,
        kind: "system",
        title: "Voice call dispatched",
        detail: log.called.join(", "),
      });
    }
    if (log.texted.length > 0) {
      events.push({
        id: `${report.id}-sms`,
        at: log.at || report.autoResponderCallAt || report.updatedAt,
        kind: "system",
        title: "SMS dispatched",
        detail: log.texted.join(", "),
      });
    }
    if (log.called.length === 0 && log.texted.length === 0 && log.summary) {
      events.push({
        id: `${report.id}-dispatch`,
        at: log.at || report.autoResponderCallAt || report.updatedAt,
        kind: "system",
        title: "Responders notified",
        detail: log.summary,
      });
    }
  } else if (report.autoResponderCallAt) {
    events.push({
      id: `${report.id}-dispatch`,
      at: report.autoResponderCallAt,
      kind: "system",
      title: "Auto responder outreach",
      detail: "Nearest matching units were dialed / texted after verification.",
    });
  }

  return events.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );
}

/** Same barangay + hazard, excluding self — lightweight “related reports”. */
export function relatedReports(
  report: HazardReport,
  all: HazardReport[],
  limit = 4,
): HazardReport[] {
  return all
    .filter(
      (r) =>
        r.id !== report.id &&
        r.barangay === report.barangay &&
        (r.hazardHint === report.hazardHint ||
          r.citizenUid === report.citizenUid),
    )
    .slice(0, limit);
}
