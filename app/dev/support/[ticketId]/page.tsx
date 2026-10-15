"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { SupportDetail } from "@/components/SupportDetail";

type PageProps = {
  params: Promise<{ ticketId: string }>;
};

export default function DeveloperSupportDetailPage({ params }: PageProps) {
  const { ticketId: rawId } = use(params);
  const ticketId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <SupportDetail ticketId={ticketId} />
      </DeveloperShell>
    </AuthGate>
  );
}
