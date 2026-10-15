"use client";

import { use } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandWorkspaceProvider } from "@/components/CommandWorkspaceProvider";
import { DeveloperShell } from "@/components/DeveloperShell";
import { IncidentDetail } from "@/components/IncidentDetail";
import { FadeIn } from "@/components/motion/primitives";

type PageProps = {
  params: Promise<{ reportId: string }>;
};

export default function DeveloperIncidentDetailPage({ params }: PageProps) {
  const { reportId: rawId } = use(params);
  const reportId = decodeURIComponent(rawId);

  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <CommandWorkspaceProvider>
          <FadeIn delay={0.04} y={0}>
            <IncidentDetail reportId={reportId} backHref="/dev/incidents" />
          </FadeIn>
        </CommandWorkspaceProvider>
      </DeveloperShell>
    </AuthGate>
  );
}
