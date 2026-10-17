"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { MySupportTicketDetail } from "@/components/MySupportTicketDetail";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

/** Officer: read-only view of a ticket they filed. */
export default function AdminMySupportDetailPage({ params }: PageProps) {
  const { ticketId: rawId } = use(params);
  const ticketId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <MySupportTicketDetail
          ticketId={ticketId}
          backHref="/admin/support"
        />
      </CommandShell>
    </AuthGate>
  );
}
