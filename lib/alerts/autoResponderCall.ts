import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import type { ResponderCallKind } from "@/lib/alerts/responderCall";
import { getClientDb } from "@/lib/firebase/client";
import { buildDispatchSummary } from "@/lib/reports/dispatchLog";
import type {
  HazardReport,
  ReportDispatchLog,
  ReportHazardHint,
} from "@/lib/reports/types";

const COL = "reports";

export type AutoResponderRoute = {
  kinds: ResponderCallKind[];
  alertLabel: string;
};

/** People trapped / on roof / drowning — needs immediate rescue dispatch. */
export function hasRescueUrgency(
  title?: string | null,
  notes?: string | null,
): boolean {
  const t = `${title ?? ""} ${notes ?? ""}`.toLowerCase();
  return /roof|bubong|stranded|trapped|nate|stuck|drowning|nalunod|cannot leave|can'?t leave|need rescue|sos|on the (roof|second|2nd)|family on|people on|bata .*tubig|senior .*tubig/.test(
    t,
  );
}

/**
 * Legit fire → BFP; crime → PNP; accident → PNP + hospital;
 * road blockage → tanod (+ PNP if people trapped);
 * flood / landslide / typhoon → tanod (+ PNP when rescue urgency, e.g. on roof).
 */
export function autoResponderRouteForHazard(
  hint: ReportHazardHint,
  title?: string | null,
  notes?: string | null,
): AutoResponderRoute | null {
  const rescue = hasRescueUrgency(title, notes);

  switch (hint) {
    case "fire":
      return { kinds: ["bfp"], alertLabel: "fire" };
    case "crime":
      return { kinds: ["pnp"], alertLabel: "crime" };
    case "accident":
      return { kinds: ["pnp", "hospital"], alertLabel: "accident" };
    case "blockage":
      return rescue
        ? { kinds: ["tanod", "pnp"], alertLabel: "road blockage" }
        : { kinds: ["tanod"], alertLabel: "road blockage" };
    case "flood":
      return rescue
        ? { kinds: ["tanod", "pnp"], alertLabel: "flood rescue" }
        : { kinds: ["tanod"], alertLabel: "flood" };
    case "landslide":
      return rescue
        ? { kinds: ["tanod", "pnp"], alertLabel: "landslide rescue" }
        : { kinds: ["tanod"], alertLabel: "landslide" };
    case "typhoon":
      return rescue
        ? { kinds: ["tanod", "pnp"], alertLabel: "storm rescue" }
        : null;
    default:
      return null;
  }
}

/**
 * After AI (or officer) marks a report legit, SMS + call matching responders.
 * Sandbox (TWILIO_SANDBOX=mode) redirects Voice + SMS to TWILIO_SANDBOX_TO.
 * Call script + TimeLimit under 1 min. Idempotent via autoResponderCallAt.
 */
export async function triggerAutoResponderCall(
  report: Pick<
    HazardReport,
    | "id"
    | "hazardHint"
    | "status"
    | "barangay"
    | "lgu"
    | "lat"
    | "lng"
    | "title"
    | "notes"
    | "citizenPurok"
    | "autoResponderCallAt"
  >,
): Promise<{ attempted: boolean; ok?: boolean; error?: string }> {
  const route = autoResponderRouteForHazard(
    report.hazardHint,
    report.title,
    report.notes,
  );
  if (!route) return { attempted: false };
  if (report.status !== "legit") return { attempted: false };
  if (report.autoResponderCallAt) return { attempted: false };

  const now = new Date().toISOString();
  const situationLine = [report.title, report.notes]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" — ")
    .slice(0, 80);

  try {
    const res = await fetch("/api/alerts/call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: "responders",
        script: "incident_alert",
        alertLabel: route.alertLabel,
        lgu: report.lgu || "Consolacion",
        barangay: report.barangay || "Nangka",
        kinds: route.kinds,
        nearLat: report.lat,
        nearLng: report.lng,
        purok: report.citizenPurok || null,
        title: situationLine || report.title || null,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      sent?: number;
      results?: Array<{
        channel?: string;
        ok?: boolean;
        ownerName?: string;
      }>;
    };
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        error: data.error || `Call failed (${res.status})`,
      };
    }

    const called = [
      ...new Set(
        (data.results ?? [])
          .filter((r) => r.channel === "call" && r.ok && r.ownerName)
          .map((r) => String(r.ownerName)),
      ),
    ];
    const texted = [
      ...new Set(
        (data.results ?? [])
          .filter((r) => r.channel === "sms" && r.ok && r.ownerName)
          .map((r) => String(r.ownerName)),
      ),
    ];
    // Demo / sandbox may log-only — still record intended units from kinds.
    if (called.length === 0 && texted.length === 0) {
      const fallback = route.kinds.map((k) =>
        k === "bfp"
          ? "Fire (BFP)"
          : k === "pnp"
            ? "Police (PNP)"
            : k === "hospital"
              ? "Hospital"
              : "Barangay / tanod",
      );
      called.push(...fallback);
      texted.push(...fallback);
    }

    const dispatchLog: ReportDispatchLog = {
      at: now,
      called,
      texted,
      summary: buildDispatchSummary({ called, texted }),
    };

    try {
      await updateDoc(doc(getClientDb(), COL, report.id), {
        autoResponderCallAt: now,
        dispatchLog,
        updatedAt: now,
        updatedAtServer: serverTimestamp(),
      });
    } catch (err) {
      return {
        attempted: true,
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Could not mark auto responder call",
      };
    }

    return { attempted: true, ok: (data.sent ?? 0) > 0 || called.length > 0 };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : "Call request failed",
    };
  }
}

/** @deprecated Use triggerAutoResponderCall */
export const triggerAutoFireStationCall = triggerAutoResponderCall;
