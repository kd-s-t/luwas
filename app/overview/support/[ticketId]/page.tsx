"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { SupportDetail } from "@/components/SupportDetail";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default function CommandSupportDetailPage({ params }: PageProps) {
  const { ticketId: rawId } = use(params);
  const ticketId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <SupportDetail ticketId={ticketId} />
      </CommandShell>
    </AuthGate>
  );
}
