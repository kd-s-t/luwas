"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { CommandOverview } from "@/components/CommandOverview";
import { CommandShell } from "@/components/CommandShell";
import {
  CommandContentSkeleton,
  PageLoadSkeleton,
} from "@/components/PageLoadSkeleton";
import { SituationMap } from "@/components/SituationMap";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";

type CommandPanel = "overview" | "map";

function readPanel(raw: string | null): CommandPanel | "workspace" {
  if (raw === "workspace" || raw === "map") return raw;
  return "overview";
}

function CommandPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const panel = readPanel(searchParams.get("view"));
  const reportId = searchParams.get("report");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Legacy workspace URLs → dedicated incidents routes.
  useEffect(() => {
    if (panel !== "workspace") return;
    if (reportId) {
      router.replace(
        `/admin/incidents/${encodeURIComponent(reportId)}`,
      );
    } else {
      router.replace("/admin/incidents");
    }
  }, [panel, reportId, router]);

  const fill = panel === "map" || panel === "overview";

  if (panel === "workspace") {
    return (
      <CommandShell>
        <CommandContentSkeleton />
      </CommandShell>
    );
  }

  return (
    <CommandShell fill={fill}>
      {!mounted ? (
        <CommandContentSkeleton fill />
      ) : panel === "overview" ? (
        <CommandOverview />
      ) : user ? (
        <FadeIn
          delay={0.04}
          y={0}
          key={panel}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <SituationMap officerUid={user.uid} fillRemaining />
        </FadeIn>
      ) : null}
    </CommandShell>
  );
}

export default function CommandPage() {
  return (
    <AuthGate mode="protected" role="officer">
      <Suspense fallback={<PageLoadSkeleton />}>
        <CommandPageInner />
      </Suspense>
    </AuthGate>
  );
}
