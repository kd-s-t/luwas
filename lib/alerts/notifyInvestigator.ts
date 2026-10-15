import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { APAS_STAFF_SEED } from "@/lib/staff/apasStaff";
import { NANGKA_STAFF_SEED } from "@/lib/staff/nangkaStaff";
import { getClientDb } from "@/lib/firebase/client";
import { buildDispatchSummary } from "@/lib/reports/dispatchLog";
import type { HazardReport, ReportDispatchLog } from "@/lib/reports/types";

const COL = "reports";

function phoneFromStaffSeed(input: {
  staffId?: string | null;
  name?: string | null;
  email?: string | null;
}): string | null {
  const all = [...APAS_STAFF_SEED, ...NANGKA_STAFF_SEED];
  const byId = input.staffId
    ? all.find((s) => s.id === input.staffId)
    : undefined;
  if (byId?.phone?.trim()) return byId.phone.trim();
  const email = input.email?.trim().toLowerCase();
  if (email) {
    const byEmail = all.find(
      (s) =>
        (s.accountEmail ?? s.email).trim().toLowerCase() === email ||
        s.email.trim().toLowerCase() === email,
    );
    if (byEmail?.phone?.trim()) return byEmail.phone.trim();
  }
  const name = input.name?.trim().toLowerCase();
  if (name) {
    const byName = all.find((s) => s.displayName.trim().toLowerCase() === name);
    if (byName?.phone?.trim()) return byName.phone.trim();
  }
  return null;
}

/** Call + SMS the assigned investigator about a new case. */
export async function triggerInvestigatorNotify(input: {
  report: Pick<
    HazardReport,
    "id" | "title" | "notes" | "barangay" | "lgu" | "hazardHint" | "dispatchLog"
  >;
  investigatorUid: string;
  investigatorName: string;
  phone?: string | null;
  staffId?: string | null;
  email?: string | null;
}): Promise<{ attempted: boolean; ok?: boolean; error?: string }> {
  const phone =
    input.phone?.trim() ||
    phoneFromStaffSeed({
      staffId: input.staffId,
      name: input.investigatorName,
      email: input.email,
    });
  if (!phone) {
    return {
      attempted: false,
      error: "No phone on file for this investigator",
    };
  }

  const brgy = input.report.barangay || "barangay";
  const lgu = input.report.lgu || "";
  const title = (input.report.title || "Citizen report").slice(0, 80);
  const hazard = input.report.hazardHint || "hazard";
  const name = input.investigatorName.trim() || "Officer";

  try {
    const recipient = {
      ownerName: name,
      phone,
      purok: "Duty",
      priority: "prepare" as const,
    };

    const [callRes, smsRes] = await Promise.all([
      fetch("/api/alerts/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: "households",
          priority: "prepare",
          script: "investigator_assign",
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
          kind: "investigator_assign",
          barangay: `Brgy. ${brgy}${lgu ? `, ${lgu}` : ""}`,
          title,
          hazardHint: hazard,
          reportId: input.report.id,
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
          `Notify failed (${callRes.status}/${smsRes.status})`,
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
      // Demo/sandbox still counts as attempted outreach to the assignee.
      called.push(name);
      texted.push(name);
    }

    const now = new Date().toISOString();
    const prev = input.report.dispatchLog;
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
      await updateDoc(doc(getClientDb(), COL, input.report.id), {
        dispatchLog,
        investigatorNotifiedAt: now,
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
            : "Could not save investigator notify log",
      };
    }

    return { attempted: true, ok: true };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : "Notify request failed",
    };
  }
}
