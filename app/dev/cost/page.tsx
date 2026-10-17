"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { AuthGate } from "@/components/AuthGate";
import { DeveloperShell } from "@/components/DeveloperShell";
import { FadeIn } from "@/components/motion/primitives";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const COST_SCENARIOS = [
  {
    id: "cup",
    label: "Initial",
    volume: "~80 reports · ~25 ID · ~120 chat · ~20 dispatch",
    total: "~$20–25",
    lines: [
      { name: "Gemini", amount: "~$0.25" },
      { name: "Vertex AutoML (≈1 hr serve)", amount: "~$1–5" },
      { name: "Firebase", amount: "~$2" },
      { name: "Twilio (SMS + Voice)", amount: "~$16" },
      { name: "ElevenLabs TTS", amount: "~$0–5" },
      { name: "Resend (email)", amount: "~$0" },
      { name: "Earth Engine", amount: "$0" },
    ],
  },
  {
    id: "quiet",
    label: "Quiet barangay",
    volume: "~400 reports · ~80 ID · ~500 chat · ~80 dispatch",
    total: "~$80",
    lines: [
      { name: "Gemini", amount: "~$1.05" },
      { name: "Vertex AutoML (≈1 hr serve)", amount: "~$1–5" },
      { name: "Firebase (Blaze)", amount: "~$8" },
      { name: "Twilio (SMS + Voice)", amount: "~$65" },
      { name: "ElevenLabs TTS (Starter)", amount: "~$5" },
      { name: "Resend (email)", amount: "~$0" },
      { name: "Earth Engine", amount: "$0" },
    ],
  },
  {
    id: "storm",
    label: "Active storm",
    volume: "~2500 reports · ~200 ID · ~2000 chat · ~500 dispatch",
    total: "~$460",
    lines: [
      { name: "Gemini", amount: "~$5.40" },
      { name: "Vertex AutoML (≈1 hr serve)", amount: "~$1–5" },
      { name: "Firebase (Storage / Hosting egress)", amount: "~$35" },
      { name: "Twilio (SMS + Voice)", amount: "~$400" },
      { name: "ElevenLabs TTS (Creator)", amount: "~$22" },
      { name: "Resend (email)", amount: "~$0–20" },
      { name: "Earth Engine", amount: "$0" },
    ],
  },
] as const;

const UNIT_RATES = [
  { name: "Gemini report validate", amount: "~$0.0008 / call" },
  { name: "Gemini register ID", amount: "~$0.0011 / call" },
  { name: "Gemini chat / assist", amount: "~$0.0012 / call" },
  { name: "Gemini rates", amount: "$0.30 / 1M in · $2.50 / 1M out" },
  { name: "Twilio SMS (PH)", amount: "~$0.241 / segment" },
  { name: "Twilio Voice (PH)", amount: "~$0.29 / min" },
  { name: "Twilio auto-dispatch (typical)", amount: "~$0.77" },
  { name: "Vertex serve", amount: "$1.375 / hr" },
  { name: "Vertex train", amount: "$3.465 / hr" },
] as const;

export default function DeveloperCostPage() {
  const [scenarioId, setScenarioId] = useState<
    (typeof COST_SCENARIOS)[number]["id"]
  >("quiet");
  const scenario =
    COST_SCENARIOS.find((s) => s.id === scenarioId) ?? COST_SCENARIOS[1];

  return (
    <AuthGate mode="protected" role="developer">
      <DeveloperShell>
        <FadeIn delay={0.04} y={10}>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
                  Cost
                </h1>
                <Dialog>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] transition hover:border-[var(--foreground)]/40 hover:text-[var(--foreground)]"
                      aria-label="Unit rates"
                    >
                      <Info className="size-3.5" strokeWidth={2} />
                      Unit rates
                    </button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Unit rates</DialogTitle>
                      <DialogDescription>
                        Per-call and per-unit list prices used in the estimates.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <ul className="divide-y divide-[var(--border)]">
                        {UNIT_RATES.map((row) => (
                          <li
                            key={row.name}
                            className="flex items-baseline justify-between gap-4 py-2 text-sm"
                          >
                            <span className="text-[var(--muted)]">
                              {row.name}
                            </span>
                            <span className="shrink-0 font-mono tabular-nums text-[var(--foreground)]">
                              {row.amount}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </DialogBody>
                  </DialogContent>
                </Dialog>
              </div>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Monthly estimate by volume from docs/cost.md (Oct 2026 list
                prices). Not a GCP / Twilio invoice.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {COST_SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setScenarioId(s.id)}
                  className={cn(
                    "border px-3 py-1.5 text-sm transition",
                    scenarioId === s.id
                      ? "border-[#0f1b2d] bg-[#0f1b2d] text-white"
                      : "border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--foreground)]/40",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-[var(--muted)]">{scenario.volume}</p>

            <div>
              <ul className="divide-y divide-[var(--border)]">
                {scenario.lines.map((line) => (
                  <li
                    key={line.name}
                    className="flex items-baseline justify-between gap-4 py-2 text-sm"
                  >
                    <span className="text-[var(--foreground)]">{line.name}</span>
                    <span className="shrink-0 font-mono tabular-nums text-[var(--foreground)]">
                      {line.amount}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex items-baseline justify-between gap-4 font-mono text-sm font-semibold tabular-nums text-[#16794c]">
                <span>Total</span>
                <span>
                  {scenario.total}
                  <span className="ml-1 font-normal text-[var(--muted)]">
                    / month
                  </span>
                </span>
              </p>
            </div>

          </div>
        </FadeIn>
      </DeveloperShell>
    </AuthGate>
  );
}
