import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import { buildDispatchSummary } from "@/lib/reports/dispatchLog";
import type { HazardReport, ReportDispatchLog } from "@/lib/reports/types";

const COL = "reports";

/**
 * After ops marks a report dispatched: SMS + call the reporter.
 * Idempotent via reporterDispatchNotifiedAt. Needs reporterPhone on the report.
 */
export async function triggerReporterDispatchNotify(
  report: Pick<
    HazardReport,
    | "id"
    | "title"
    | "barangay"
    | "lgu"
    | "hazardHint"
    | "citizenName"
    | "reporterPhone"
    | "dispatchLog"
  > & {
    reporterDispatchNotifiedAt?: string | null;
  },
): Promise<{ attempted: boolean; ok?: boolean; error?: string }> {
  if (report.reporterDispatchNotifiedAt) {
    return { attempted: false };
  }

  const phone = report.reporterPhone?.trim() || null;
  if (!phone) {
    return {
      attempted: false,
      error: "No reporter phone on this report",
    };
  }

  const brgy = report.barangay || "barangay";
  const lgu = report.lgu || "";
  const title = (report.title || "Citizen report").slice(0, 80);
  const hazard = report.hazardHint || "hazard";
  const name = report.citizenName?.trim() || "Reporter";

  try {
    const recipient = {
      ownerName: name,
      phone,
      purok: "Reporter",
      priority: "prepare" as const,
    };

    const [callRes, smsRes] = await Promise.all([
      fetch("/api/alerts/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "households",
          priority: "prepare",
          script: "reporter_dispatch",
          barangay: `Brgy. ${brgy}`,
          title,
          hazardHint: hazard,
          recipients: [recipient],
        }),
      }),
      fetch("/api/alerts/sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: "prepare",
          kind: "reporter_dispatch",
          barangay: `Brgy. ${brgy}${lgu ? `, ${lgu}` : ""}`,
          title,
          hazardHint: hazard,
          reportId: report.id,
          recipients: [recipient],
        }),
      }),
    ]);

    const callData = (await callRes.json()) as {
      error?: string;
      sent?: number;
      results?: Array<{ ok?: boolean; ownerName?: string; channel?: string }>;
    };
    const smsData = (await smsRes.json()) as {
      error?: string;
      sent?: number;
      results?: Array<{ ok?: boolean; ownerName?: string; channel?: string }>;
    };

    if (!callRes.ok && !smsRes.ok) {
      return {
        attempted: true,
        ok: false,
        error:
          callData.error ||
          smsData.error ||
          `Reporter notify failed (${callRes.status}/${smsRes.status})`,
      };
    }

    const called = [
      ...new Set(
        (callData.results ?? [])
          .filter((r) => r.ok)
          .map((r) => String(r.ownerName || name)),
      ),
    ];
    const texted = [
      ...new Set(
        (smsData.results ?? [])
          .filter((r) => r.ok)
          .map((r) => String(r.ownerName || name)),
      ),
    ];
    if (called.length === 0 && (callRes.ok || (callData.sent ?? 0) > 0)) {
      called.push(name);
    }
    if (texted.length === 0 && (smsRes.ok || (smsData.sent ?? 0) > 0)) {
      texted.push(name);
    }
    if (called.length === 0 && texted.length === 0) {
      called.push(name);
      texted.push(name);
    }

    const now = new Date().toISOString();
    const prev = report.dispatchLog;
    const dispatchLog: ReportDispatchLog = {
      at: now,
      called: [...new Set([...(prev?.called ?? []), ...called])],
      texted: [...new Set([...(prev?.texted ?? []), ...texted])],
      summary: buildDispatchSummary({
        called: [...new Set([...(prev?.called ?? []), ...called])],
        texted: [...new Set([...(prev?.texted ?? []), ...texted])],
      }),
    };

    try {
      await updateDoc(doc(getClientDb(), COL, report.id), {
        dispatchLog,
        reporterDispatchNotifiedAt: now,
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
            : "Could not save reporter notify log",
      };
    }

    return { attempted: true, ok: true };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : "Reporter notify request failed",
    };
  }
}
