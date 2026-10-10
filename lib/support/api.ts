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
  type Unsubscribe,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

export type SupportTicketStatus = "open" | "in_progress" | "resolved" | "closed";

export type SupportMessage = {
  id: string;
  body: string;
  authorUid: string;
  authorName: string;
  createdAt: string;
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
  uid: string;
};

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
    if (!body) continue;
    rows.push({
      id: String(m.id ?? `${m.createdAt ?? ""}-${rows.length}`),
      body: body.slice(0, 2000),
      authorUid: String(m.authorUid ?? ""),
      authorName: String(m.authorName ?? "Officer"),
      createdAt: String(m.createdAt ?? ""),
    });
  }
  rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return rows;
}

export async function submitSupportTicket(input: SupportTicketInput) {
  if (!input.uid) throw new Error("Sign in to send a bug report.");
  const summary = input.summary.trim();
  const details = input.details.trim();
  if (!summary) throw new Error("Describe the bug in a short summary.");
  if (summary.length > 200) throw new Error("Summary is too long.");
  if (details.length > 4000) throw new Error("Details are too long.");

  await addDoc(collection(getClientDb(), "supportTickets"), {
    kind: "bug",
    email: input.email.trim().slice(0, 200),
    pageUrl: input.pageUrl.trim().slice(0, 500),
    summary,
    details,
    uid: input.uid,
    status: "open" satisfies SupportTicketStatus,
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : "",
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
    assignedToUid: null,
    assignedToName: null,
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
}): Promise<void> {
  const body = input.body.trim();
  if (!body) throw new Error("Write a message first.");
  if (body.length > 2000) throw new Error("Message is too long.");
  const now = new Date().toISOString();
  const message: SupportMessage = {
    id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    body,
    authorUid: input.authorUid,
    authorName: input.authorName.trim().slice(0, 120) || "Officer",
    createdAt: now,
  };
  await updateDoc(doc(getClientDb(), "supportTickets", input.ticketId), {
    messages: arrayUnion(message),
    updatedAt: now,
    updatedAtServer: serverTimestamp(),
  });
}
