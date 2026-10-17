import {
  addDoc,
  arrayUnion,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  doc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

/** Permanent product-team assignee (not a Firestore user). */
export const UGNAI_DEVELOPERS_ASSIGNEE = {
  uid: "ugnai-developers",
  name: "Ugnai developers",
} as const;

/** Sample / team-bucket assignees are not real people. */
export function isPlaceholderAssignee(
  uid: string | null | undefined,
  name: string | null | undefined,
): boolean {
  const id = (uid ?? "").trim();
  const label = (name ?? "").trim();
  if (!id && !label) return false;
  if (id === UGNAI_DEVELOPERS_ASSIGNEE.uid || id.startsWith("sample-")) {
    return true;
  }
  if (/^demo\s*·/i.test(label) || label === UGNAI_DEVELOPERS_ASSIGNEE.name) {
    return true;
  }
  return false;
}

export type SupportMessage = {
  id: string;
  body: string;
  authorUid: string;
  authorName: string;
  /** Profile photo when available. */
  authorPhotoURL: string | null;
  createdAt: string;
  /** Image and/or video proxy URLs. */
  mediaUrls: string[];
};

export type SupportTicket = {
  id: string;
  kind: string;
  email: string;
  pageUrl: string;
  summary: string;
  details: string;
  uid: string;
  userAgent: string;
  status: SupportTicketStatus;
  createdAt: string;
  assignedToUid: string | null;
  assignedToName: string | null;
  /** Image and/or video proxy URLs. */
  mediaUrls: string[];
  messages: SupportMessage[];
  resolvedAt: string | null;
  resolvedByUid: string | null;
  resolvedByName: string | null;
  resolutionNote: string | null;
};

export type SupportTicketInput = {
  email: string;
  pageUrl: string;
  summary: string;
  details: string;
  /** Auth uid, or `"guest"` when not signed in. */
  uid: string;
  /** Same-origin /api/media/… URLs from uploadSupportMedia. */
  mediaUrls?: string[];
};

function mapMediaUrls(...raws: unknown[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of raws) {
    if (!Array.isArray(raw)) continue;
    for (const item of raw) {
      const url = String(item ?? "").trim();
      if (!url || url.length > 800 || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      if (out.length >= 4) return out;
    }
  }
  return out;
}

function mapTicket(
  id: string,
  data: Record<string, unknown>,
): SupportTicket {
  const statusRaw = String(data.status ?? "open");
  const status: SupportTicketStatus =
    statusRaw === "in_progress" ||
    statusRaw === "resolved" ||
    statusRaw === "closed"
      ? statusRaw
      : "open";
  return {
    id,
    kind: String(data.kind ?? "bug"),
    email: String(data.email ?? ""),
    pageUrl: String(data.pageUrl ?? ""),
    summary: String(data.summary ?? ""),
    details: String(data.details ?? ""),
    uid: String(data.uid ?? ""),
    userAgent: String(data.userAgent ?? ""),
    status,
    createdAt: String(data.createdAt ?? ""),
    assignedToUid:
      data.assignedToUid != null ? String(data.assignedToUid) : null,
    assignedToName:
      data.assignedToName != null ? String(data.assignedToName) : null,
    mediaUrls: mapMediaUrls(data.mediaUrls, data.imageUrls),
    messages: mapMessages(data.messages),
    resolvedAt: data.resolvedAt != null ? String(data.resolvedAt) : null,
    resolvedByUid:
      data.resolvedByUid != null ? String(data.resolvedByUid) : null,
    resolvedByName:
      data.resolvedByName != null ? String(data.resolvedByName) : null,
    resolutionNote:
      data.resolutionNote != null ? String(data.resolutionNote) : null,
  };
}

function mapMessages(raw: unknown): SupportMessage[] {
  if (!Array.isArray(raw)) return [];
  const rows: SupportMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const m = item as Record<string, unknown>;
    const body = String(m.body ?? "").trim();
    const mediaUrls = mapMediaUrls(m.mediaUrls, m.imageUrls);
    if (!body && mediaUrls.length === 0) continue;
    const photoRaw = m.authorPhotoURL ?? m.photoURL;
    rows.push({
      id: String(m.id ?? `${m.createdAt ?? ""}-${rows.length}`),
      body: body.slice(0, 2000),
      authorUid: String(m.authorUid ?? ""),
      authorName: String(m.authorName ?? "Officer"),
      authorPhotoURL:
        photoRaw != null && String(photoRaw).trim()
          ? String(photoRaw).trim().slice(0, 800)
          : null,
      createdAt: String(m.createdAt ?? ""),
      mediaUrls,
    });
  }
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return rows;
}

export async function submitSupportTicket(input: SupportTicketInput) {
  const summary = input.summary.trim();
  const details = input.details.trim();
  if (!summary) throw new Error("Describe the bug in a short summary.");
  if (summary.length > 200) throw new Error("Summary is too long.");
  if (details.length > 4000) throw new Error("Details are too long.");
  const uid = (input.uid.trim() || "guest").slice(0, 128);
  const mediaUrls = mapMediaUrls(input.mediaUrls);

  await addDoc(collection(getClientDb(), "supportTickets"), {
    kind: "bug",
    email: input.email.trim().slice(0, 200),
    pageUrl: input.pageUrl.trim().slice(0, 500),
    summary,
    details,
    uid,
    status: "open" satisfies SupportTicketStatus,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : "",
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    assignedToUid: null,
    assignedToName: null,
    mediaUrls,
    messages: [],
    resolvedAt: null,
    resolvedByUid: null,
    resolvedByName: null,
    resolutionNote: null,
  });
}

export function subscribeSupportTickets(
  onChange: (rows: SupportTicket[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getClientDb(), "supportTickets"),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => {
      onChange(snap.docs.map((d) => mapTicket(d.id, d.data())));
    },
    (err) => onError?.(err),
  );
}

/** Tickets filed by this auth uid (officer / citizen tracking). */
export function subscribeMySupportTickets(
  uid: string,
  onChange: (rows: SupportTicket[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const trimmed = uid.trim();
  if (!trimmed || trimmed === "guest") {
    onChange([]);
    return () => {};
  }
  const q = query(
    collection(getClientDb(), "supportTickets"),
    where("uid", "==", trimmed),
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => mapTicket(d.id, d.data()));
      rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onChange(rows);
    },
    (err) => onError?.(err),
  );
}

export async function updateSupportTicketStatus(input: {
  ticketId: string;
  status: SupportTicketStatus;
  officerUid: string;
  officerName: string;
  note?: string;
}): Promise<void> {
  const done = input.status === "resolved" || input.status === "closed";
  const now = new Date().toISOString();
  await updateDoc(doc(getClientDb(), "supportTickets", input.ticketId), {
    status: input.status,
    resolutionNote: input.note?.trim().slice(0, 1000) || null,
    resolvedAt: done ? now : null,
    resolvedByUid: done ? input.officerUid : null,
    resolvedByName: done ? input.officerName : null,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}

export async function assignSupportTicket(input: {
  ticketId: string;
  assigneeUid: string | null;
  assigneeName: string | null;
  /** When assigning someone, move open → in_progress. */
  promoteToInProgress?: boolean;
}): Promise<void> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    assignedToUid: input.assigneeUid,
    assignedToName: input.assigneeName?.trim().slice(0, 120) || null,
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  };
  if (input.promoteToInProgress && input.assigneeUid) {
    patch.status = "in_progress" satisfies SupportTicketStatus;
  }
  await updateDoc(doc(getClientDb(), "supportTickets", input.ticketId), patch);
}

export async function addSupportTicketMessage(input: {
  ticketId: string;
  body: string;
  authorUid: string;
  authorName: string;
  authorPhotoURL?: string | null;
  mediaUrls?: string[];
}): Promise<void> {
  const body = input.body.trim();
  const mediaUrls = mapMediaUrls(input.mediaUrls);
  if (!body && mediaUrls.length === 0) {
    throw new Error("Write a message or attach media.");
  }
  if (body.length > 2000) throw new Error("Message is too long.");
  const now = new Date().toISOString();
  const photo = input.authorPhotoURL?.trim().slice(0, 800) || null;
  const message: SupportMessage = {
    id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    body,
    authorUid: input.authorUid,
    authorName: input.authorName.trim().slice(0, 120) || "Officer",
    authorPhotoURL: photo,
    createdAt: now,
    mediaUrls,
  };
  await updateDoc(doc(getClientDb(), "supportTickets", input.ticketId), {
    messages: arrayUnion(message),
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}
