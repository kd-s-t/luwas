/** Client-side assistance commitments for the Resources e2e desk flow. */

export type AssistanceCommitment = {
  id: string;
  planCode: string;
  reportId: string;
  incidentCode: string;
  place: string;
  partnerId: string;
  partnerName: string;
  offerLine: string;
  note: string;
  approvedAt: string;
  status: "approved" | "tracking";
};

const STORAGE_KEY = "ugnai.assistanceCommitments.v1";

function readAll(): AssistanceCommitment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (row): row is AssistanceCommitment =>
        Boolean(row) &&
        typeof row === "object" &&
        typeof (row as AssistanceCommitment).id === "string" &&
        typeof (row as AssistanceCommitment).reportId === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(rows: AssistanceCommitment[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, 40)));
}

export function listAssistanceCommitments(): AssistanceCommitment[] {
  return readAll().sort(
    (a, b) => Date.parse(b.approvedAt) - Date.parse(a.approvedAt),
  );
}

export function commitmentForReport(
  reportId: string,
): AssistanceCommitment | null {
  return readAll().find((c) => c.reportId === reportId) ?? null;
}

export function saveAssistanceCommitment(
  input: Omit<AssistanceCommitment, "id" | "approvedAt" | "status">,
): AssistanceCommitment {
  const rows = readAll().filter((c) => c.reportId !== input.reportId);
  const next: AssistanceCommitment = {
    ...input,
    id: `commit-${input.reportId}`,
    approvedAt: new Date().toISOString(),
    status: "approved",
  };
  rows.unshift(next);
  writeAll(rows);
  return next;
}

export function subscribedReportIds(): Set<string> {
  return new Set(readAll().map((c) => c.reportId));
}

export function clearAssistanceCommitment(reportId: string): void {
  writeAll(readAll().filter((c) => c.reportId !== reportId));
}

export function clearAllAssistanceCommitments(): void {
  writeAll([]);
}

/** Drop stale approvals so Verified reports can show shortage cards again. */
export function clearCommitmentsNotIn(
  openReportIds: Iterable<string>,
): AssistanceCommitment[] {
  const open = new Set(openReportIds);
  const next = readAll().filter((c) => open.has(c.reportId));
  writeAll(next);
  return next;
}
