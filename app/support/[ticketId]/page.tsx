"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MySupportTicketDetail } from "@/components/MySupportTicketDetail";
import {
  PublicPageHeader,
  PublicShell,
} from "@/components/PublicShell";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

/** Citizen (or any signed-in non-command) ticket tracker. */
export default function PublicMySupportDetailPage({ params }: PageProps) {
  const { ticketId: rawId } = use(params);
  const ticketId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected">
      <PublicShell hideFooter>
        <PublicPageHeader
          eyebrow="Help"
          title="Support ticket"
          description="Track the status of your report."
        />
        <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <MySupportTicketDetail ticketId={ticketId} backHref="/support" />
        </main>
      </PublicShell>
    </AuthGate>
  );
}
