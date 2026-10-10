import type { PendingAccount } from "@/lib/auth/accountValidation";
import type { HazardReport } from "@/lib/reports/types";

export type OfficerNotification = {
  id: string;
  kind: "pending_registration" | "report_queue";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const QUEUE_STATUSES = new Set([
  "queued",
  "validating",
  "needs_review",
  "failed",
]);

function readStorageKey(uid: string) {
  return `luwas.officerNotifRead.${uid}`;
}

export function loadReadIds(uid: string): Set<string> {
  if (typeof window === "undefined" || !uid) return new Set();
  try {
    const raw = localStorage.getItem(readStorageKey(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function saveReadIds(uid: string, ids: Set<string>) {
  if (typeof window === "undefined" || !uid) return;
  localStorage.setItem(readStorageKey(uid), JSON.stringify([...ids]));
}

export function buildOfficerNotifications(input: {
  pending: PendingAccount[];
  reports: HazardReport[];
}): OfficerNotification[] {
  const items: OfficerNotification[] = [];

  for (const u of input.pending) {
    items.push({
      id: `pending:${u.uid}`,
      kind: "pending_registration",
      title: "Pending registration",
      body: `${u.displayName || u.email} · ${u.role}`,
      href: "/command/users",
      createdAt: u.createdAt || "",
    });
  }

  for (const r of input.reports) {
    if (!QUEUE_STATUSES.has(r.status)) continue;
    items.push({
      id: `report:${r.id}`,
      kind: "report_queue",
      title:
        r.status === "needs_review"
          ? "Needs human review"
          : "Report awaiting review",
      body: r.title || r.id,
      href: "/command/reports",
      createdAt: r.createdAt || "",
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items;
}
