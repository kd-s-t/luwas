import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

export type SupportTicketInput = {
  email: string;
  pageUrl: string;
  summary: string;
  details: string;
  uid: string;
};

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
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 400) : "",
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  });
}
