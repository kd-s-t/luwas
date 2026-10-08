"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CommandHeader } from "@/components/CommandHeader";
import {
  CommandViewSwitch,
  type CommandView,
} from "@/components/CommandViewSwitch";
import { IncidentWorkspace } from "@/components/IncidentWorkspace";
import { SituationMap } from "@/components/SituationMap";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";

const VIEW_KEY = "luwas.commandView";

function readStoredView(): CommandView {
  if (typeof window === "undefined") return "workspace";
  const raw = window.localStorage.getItem(VIEW_KEY);
  return raw === "map" ? "map" : "workspace";
}

export default function CommandPage() {
  const { user } = useAuth();
  const [view, setView] = useState<CommandView>("workspace");

  useEffect(() => {
    setView(readStoredView());
  }, []);

  function changeView(next: CommandView) {
    setView(next);
    try {
      window.localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  return (
    <AuthGate mode="protected" role="officer">
      <div className="min-h-dvh">
        <CommandHeader />
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface-raised)]/80 px-4 py-2 sm:px-6">
          <p className="text-xs text-[var(--muted)]">
            {view === "workspace"
              ? "Evidence, decisions, and activity for each report"
              : "Situation map · households, hazards, and AI overlays"}
          </p>
          <CommandViewSwitch value={view} onChange={changeView} />
        </div>
        <main className="w-full">
          {user ? (
            <FadeIn delay={0.06} y={0} key={view}>
              {view === "workspace" ? (
                <IncidentWorkspace />
              ) : (
                <SituationMap officerUid={user.uid} />
              )}
            </FadeIn>
          ) : null}
        </main>
      </div>
    </AuthGate>
  );
}
