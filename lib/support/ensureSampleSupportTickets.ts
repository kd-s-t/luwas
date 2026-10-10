import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";
import type { SupportTicketStatus } from "@/lib/support/api";

type SampleTicket = {
  id: string;
  status: SupportTicketStatus;
  email: string;
  pageUrl: string;
  summary: string;
  details: string;
  uid: string;
  assignedToUid: string | null;
  assignedToName: string | null;
};

/**
 * Idempotent sample bug tickets for Command → Support.
 * Doc IDs match firestore.rules `sup-sample-###` officer seed path.
 */
export const SAMPLE_SUPPORT_TICKETS: SampleTicket[] = [
  {
    id: "sup-sample-001",
    status: "open",
    email: "rosa.villanueva@nangka.pending.demo",
    pageUrl: "/citizen",
    summary: "Citizen report map pin jumps after confirm",
    details:
      "On mobile Safari, after I confirm a flood report the map recenter jumps to the wrong purok. Happened twice tonight near Purok 6.",
    uid: "sample-citizen-rosa",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-002",
    status: "open",
    email: "miguel.santos@nangka.pending.demo",
    pageUrl: "/login",
    summary: "Login spinner never finishes on slow network",
    details:
      "Wi‑Fi dropped mid-login. Spinner kept going for 2+ minutes with no error. Hard refresh fixed it.",
    uid: "sample-citizen-miguel",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-003",
    status: "open",
    email: "ana.reyes@nangka.pending.demo",
    pageUrl: "/my-reports",
    summary: "My reports page blank after posting photo",
    details:
      "Posted a landslide photo from the citizen flow. Redirect to My reports showed empty list until I signed out and back in.",
    uid: "sample-citizen-ana",
    assignedToUid: null,
    assignedToName: null,
  },
  {
    id: "sup-sample-004",
    status: "in_progress",
    email: "bfp.desk@nangka.demo",
    pageUrl: "/command",
    summary: "Command header badges stale until full reload",
    details:
      "Users pending badge stayed at 5 after I approved someone. Field reports badge updated only after refresh.",
    uid: "sample-officer-bfp",
    assignedToUid: "sample-assignee-mdrrmo",
    assignedToName: "Demo · MDRRMO Focal",
  },
  {
    id: "sup-sample-005",
    status: "open",
    email: "guest@luwas.local",
    pageUrl: "/support",
    summary: "Support form rejects long details past ~4k chars",
    details:
      "Pasted a long crash log; submit failed with ‘Details are too long.’ Expected a clearer counter before submit.",
    uid: "sample-citizen-guest",
    assignedToUid: null,
    assignedToName: null,
  },
];

/** Upsert sample support tickets (create-if-missing). */
export async function ensureSampleSupportTickets(): Promise<{
  created: number;
  skipped: number;
}> {
  const db = getClientDb();
  let created = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const sample of SAMPLE_SUPPORT_TICKETS) {
    const ref = doc(db, "supportTickets", sample.id);
    const existing = await getDoc(ref);
    if (existing.exists()) {
      skipped += 1;
      continue;
    }

    await setDoc(ref, {
      kind: "bug",
      email: sample.email,
      pageUrl: sample.pageUrl,
      summary: sample.summary,
      details: sample.details,
      uid: sample.uid,
      status: sample.status,
      userAgent: "LUWAS sample seed",
      createdAt: now,
      createdAtServer: serverTimestamp(),
      assignedToUid: sample.assignedToUid,
      assignedToName: sample.assignedToName,
      resolvedAt: null,
      resolvedByUid: null,
      resolvedByName: null,
      resolutionNote: null,
    });
    created += 1;
  }

  return { created, skipped };
}
