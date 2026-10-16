import type { ReportAssignee } from "@/lib/reports/types";

/** Parse assignees from Firestore; fall back to legacy lead investigator fields. */
export function mapReportAssignees(
  raw: unknown,
  investigatorUid: string | null,
  investigatorName: string | null,
  investigatedAt: string | null,
): ReportAssignee[] {
  const fromArray: ReportAssignee[] = [];
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const uid = typeof o.uid === "string" ? o.uid.trim() : "";
      if (!uid) continue;
      const name =
        typeof o.name === "string" && o.name.trim()
          ? o.name.trim().slice(0, 120)
          : uid;
      const assignedAt =
        typeof o.assignedAt === "string" && o.assignedAt
          ? o.assignedAt
          : investigatedAt || new Date().toISOString();
      if (fromArray.some((a) => a.uid === uid)) continue;
      fromArray.push({ uid, name, assignedAt });
    }
  }
  if (fromArray.length > 0) return fromArray;
  if (investigatorUid?.trim()) {
    return [
      {
        uid: investigatorUid.trim(),
        name: investigatorName?.trim() || investigatorUid.trim(),
        assignedAt: investigatedAt || new Date().toISOString(),
      },
    ];
  }
  return [];
}

export function assigneeLabel(assignees: ReportAssignee[]): string {
  if (assignees.length === 0) return "";
  if (assignees.length === 1) return assignees[0]!.name;
  if (assignees.length === 2) {
    return `${assignees[0]!.name} · ${assignees[1]!.name}`;
  }
  return `${assignees[0]!.name} +${assignees.length - 1}`;
}

export function reportHasAssignee(input: {
  assignees?: ReportAssignee[] | null;
  investigatorUid?: string | null;
  investigatorName?: string | null;
}): boolean {
  if (input.assignees && input.assignees.length > 0) return true;
  return Boolean(
    input.investigatorUid?.trim() || input.investigatorName?.trim(),
  );
}
