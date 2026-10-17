import type { OfficerProfile } from "@/lib/auth/types";
import type { HazardReport } from "@/lib/reports/types";
import { hazardHintLabel } from "@/lib/reports/types";
import { APAS_STAFF_SEED } from "@/lib/staff/apasStaff";
import { NANGKA_STAFF_SEED } from "@/lib/staff/nangkaStaff";
import type { StaffMember, StaffMemberInput } from "@/lib/staff/types";

type DoneRole = "reporter" | "assignee" | "captain";

type DoneRecipient = {
  email: string;
  name: string;
  role: DoneRole;
};

function staffEmail(s: StaffMember | StaffMemberInput): string | null {
  const e = (s.accountEmail ?? s.email)?.trim();
  return e || null;
}

function emailForAssignee(input: {
  uid: string;
  name: string;
  officers: OfficerProfile[];
  staffRows: StaffMember[];
  seed: StaffMemberInput[];
}): string | null {
  const { uid, name, officers, staffRows, seed } = input;
  if (uid.startsWith("staff:")) {
    const id = uid.slice("staff:".length);
    const s =
      staffRows.find((row) => row.id === id) ||
      seed.find((row) => row.id === id);
    return s ? staffEmail(s) : null;
  }
  const officer = officers.find((o) => o.uid === uid);
  if (officer?.email?.trim()) return officer.email.trim();
  if (officer?.staffId) {
    const s =
      staffRows.find((row) => row.id === officer.staffId) ||
      seed.find((row) => row.id === officer.staffId);
    if (s) return staffEmail(s);
  }
  const byName = [...staffRows, ...seed].find(
    (row) => row.displayName.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  return byName ? staffEmail(byName) : null;
}

/** Collect reporter + assignees + captain emails for Mark done Resend. */
export function collectReportDoneRecipients(input: {
  report: HazardReport;
  officers: OfficerProfile[];
  staffRows: StaffMember[];
  isApasArea: boolean;
}): DoneRecipient[] {
  const seed = input.isApasArea ? APAS_STAFF_SEED : NANGKA_STAFF_SEED;
  const out: DoneRecipient[] = [];
  const seen = new Set<string>();

  function push(email: string | null | undefined, name: string, role: DoneRole) {
    const e = email?.trim();
    if (!e) return;
    const key = e.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ email: e, name: name.trim() || "Recipient", role });
  }

  push(
    input.report.reporterEmail,
    input.report.citizenName || "Reporter",
    "reporter",
  );

  const assignees =
    input.report.assignees?.length > 0
      ? input.report.assignees
      : input.report.investigatorUid
        ? [
            {
              uid: input.report.investigatorUid,
              name:
                input.report.investigatorName || input.report.investigatorUid,
              assignedAt: input.report.investigatedAt || input.report.updatedAt,
            },
          ]
        : [];

  for (const a of assignees) {
    push(
      emailForAssignee({
        uid: a.uid,
        name: a.name,
        officers: input.officers,
        staffRows: input.staffRows,
        seed,
      }),
      a.name,
      "assignee",
    );
  }

  const captainsLive = input.staffRows.filter(
    (s) => s.rank === "captain" && s.status === "active",
  );
  const captains = captainsLive.length > 0 ? captainsLive : seed.filter(
    (s) => s.rank === "captain" && s.status === "active",
  );
  for (const s of captains) {
    push(staffEmail(s), s.displayName, "captain");
  }

  return out;
}

/** Email-only close notice (no SMS / call). */
export async function triggerReportDoneNotify(input: {
  report: HazardReport;
  officers: OfficerProfile[];
  staffRows: StaffMember[];
  isApasArea: boolean;
  closedByName: string;
}): Promise<{ attempted: boolean; ok?: boolean; sent?: number; error?: string }> {
  const recipients = collectReportDoneRecipients(input);
  if (recipients.length === 0) {
    return { attempted: false, error: "No recipient emails on file" };
  }

  const place = [
    input.report.citizenPurok,
    input.report.barangay ? `Brgy. ${input.report.barangay}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  try {
    const res = await fetch("/api/reports/done-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipients,
        reportId: input.report.id,
        title: input.report.title || "Citizen report",
        hazardLabel: hazardHintLabel(input.report.hazardHint),
        place,
        notes: input.report.notes || undefined,
        barangay: input.report.barangay
          ? `Brgy. ${input.report.barangay}`
          : "Barangay",
        lgu: input.report.lgu || "",
        closedByName: input.closedByName,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      ok?: boolean;
      sent?: number;
    };
    if (!res.ok) {
      return {
        attempted: true,
        ok: false,
        error: data.error || `Done notify failed (${res.status})`,
      };
    }
    return {
      attempted: true,
      ok: Boolean(data.ok),
      sent: data.sent ?? 0,
    };
  } catch (err) {
    return {
      attempted: true,
      ok: false,
      error: err instanceof Error ? err.message : "Done notify request failed",
    };
  }
}
