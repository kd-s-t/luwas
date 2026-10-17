import type { SupportTicket } from "@/lib/support/api";

export type DeveloperNotification = {
  id: string;
  kind: "support_assigned" | "support_open";
  title: string;
  body: string;
  href: string;
  createdAt: string;
};

const ACTIVE = new Set(["open", "in_progress"]);

function readStorageKey(uid: string) {
  return `ugnai.devNotifRead.${uid}`;
}

export function loadDevReadIds(uid: string): Set<string> {
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

export function saveDevReadIds(uid: string, ids: Set<string>) {
  if (typeof window === "undefined" || !uid) return;
  localStorage.setItem(readStorageKey(uid), JSON.stringify([...ids]));
}

/** Support queue alerts for the developer console bell. */
export function buildDeveloperNotifications(input: {
  tickets: SupportTicket[];
  uid: string;
}): DeveloperNotification[] {
  const items: DeveloperNotification[] = [];
  const uid = input.uid.trim();

  for (const t of input.tickets) {
    if (!ACTIVE.has(t.status)) continue;
    const assignedToMe = Boolean(uid) && t.assignedToUid === uid;
    items.push({
      id: `support:${t.id}:${t.status}:${t.assignedToUid ?? "none"}`,
      kind: assignedToMe ? "support_assigned" : "support_open",
      title: assignedToMe ? "Assigned to you" : "Support ticket",
      body: t.summary || t.id,
      href: `/dev/support/${encodeURIComponent(t.id)}`,
      createdAt: t.createdAt || "",
    });
  }

  items.sort((a, b) => {
    // Assigned-to-me first, then newest.
    if (a.kind !== b.kind) {
      return a.kind === "support_assigned" ? -1 : 1;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
  return items;
}
