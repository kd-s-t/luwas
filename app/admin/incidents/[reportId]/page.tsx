"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandShell } from "@/components/CommandShell";
import { IncidentDetail } from "@/components/IncidentDetail";
import { FadeIn } from "@/components/motion/primitives";

type PageProps = {
  params: Promise<{ reportId: string }>;
};

export default function CommandIncidentDetailPage({ params }: PageProps) {
  const { reportId: rawId } = use(params);
  const reportId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected" role="officer">
      <CommandShell>
        <FadeIn delay={0.04} y={0}>
          <IncidentDetail reportId={reportId} />
        </FadeIn>
      </CommandShell>
    </AuthGate>
  );
}
