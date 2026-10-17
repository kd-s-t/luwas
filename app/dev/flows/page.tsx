"use client";

import { Suspense, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { BarangayOnboardFlow } from "@/components/BarangayOnboardFlow";
import { CalamityBeforeStormFlow } from "@/components/CalamityBeforeStormFlow";
import { CalamityAftermathFlow } from "@/components/CalamityAftermathFlow";
import { CalamityDuringLandfallFlow } from "@/components/CalamityDuringLandfallFlow";
import { CarIncidentFlow } from "@/components/CarIncidentFlow";
import { EarthEngineFlow } from "@/components/EarthEngineFlow";
import { PartnerOnboardFlow } from "@/components/PartnerOnboardFlow";
import { RegistrationFlow } from "@/components/RegistrationFlow";
import { VertexAgentFlow } from "@/components/VertexAgentFlow";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "onboard", label: "Barangay Onboard" },
  { id: "partners", label: "Partner Onboard" },
  { id: "earth-engine", label: "Earth Engine" },
  { id: "vertex", label: "Gemini Agent Platform" },
  { id: "registration", label: "Register Citizen" },
  { id: "incident", label: "Incident Report" },
  { id: "calamity", label: "Before Storm" },
  { id: "during", label: "During Landfall" },
  { id: "aftermath", label: "Aftermath" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const TAB_IDS = new Set<string>(TABS.map((t) => t.id));
const DEFAULT_TAB: TabId = "onboard";

function parseFlowParam(raw: string | null): TabId {
  if (raw && TAB_IDS.has(raw)) return raw as TabId;
  return DEFAULT_TAB;
}

function FlowsTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useMemo(
    () => parseFlowParam(searchParams.get("flow")),
    [searchParams],
  );

  const setTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === DEFAULT_TAB) {
        params.delete("flow");
      } else {
        params.set("flow", id);
      }
      const q = params.toString();
      router.replace(q ? `/dev/flows?${q}` : "/dev/flows", { scroll: false });
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-full min-h-0 flex-col px-4 py-5 sm:px-6 sm:py-6">
      <div className="mb-3 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm ring-1 transition",
              tab === t.id
                ? "bg-[#0f1b2d] text-white ring-[#0f1b2d]"
                : "bg-white text-[var(--foreground)] ring-[var(--border)] hover:ring-[var(--foreground)]/30",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {tab === "onboard" ? (
          <BarangayOnboardFlow />
        ) : tab === "partners" ? (
          <PartnerOnboardFlow />
        ) : tab === "earth-engine" ? (
          <EarthEngineFlow />
        ) : tab === "vertex" ? (
          <VertexAgentFlow />
        ) : tab === "registration" ? (
          <RegistrationFlow />
        ) : tab === "incident" ? (
          <CarIncidentFlow />
        ) : tab === "calamity" ? (
          <CalamityBeforeStormFlow />
        ) : tab === "during" ? (
          <CalamityDuringLandfallFlow />
        ) : (
          <CalamityAftermathFlow />
        )}
      </div>
    </div>
  );
}

export default function DeveloperFlowsPage() {
  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell fill>
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
              Loading flows…
            </div>
          }
        >
          <FlowsTabs />
        </Suspense>
      </DeveloperShell>
    </AuthGate>
  );
}
