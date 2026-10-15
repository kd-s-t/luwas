"use client";

import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { BarangayOnboardFlow } from "@/components/BarangayOnboardFlow";
import { CalamityBeforeStormFlow } from "@/components/CalamityBeforeStormFlow";
import { CalamityAftermathFlow } from "@/components/CalamityAftermathFlow";
import { CalamityDuringLandfallFlow } from "@/components/CalamityDuringLandfallFlow";
import { CarIncidentFlow } from "@/components/CarIncidentFlow";
import { EarthEngineFlow } from "@/components/EarthEngineFlow";
import { RegistrationFlow } from "@/components/RegistrationFlow";
import { VertexAgentFlow } from "@/components/VertexAgentFlow";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "onboard", label: "Barangay Onboard" },
  { id: "earth-engine", label: "Earth Engine" },
  { id: "vertex", label: "Vertex AI" },
  { id: "registration", label: "Register Citizen" },
  { id: "incident", label: "Car Incident" },
  { id: "calamity", label: "Before Storm" },
  { id: "during", label: "During Landfall" },
  { id: "aftermath", label: "Aftermath" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function DeveloperFlowsPage() {
  const [tab, setTab] = useState<TabId>("onboard");

  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell fill>
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
      </DeveloperShell>
    </AuthGate>
  );
}
