"use client";

import { Shield } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TRUST_CAPS } from "@/lib/reports/trustScore";
import { cn } from "@/lib/utils";

/** How Trust % is scored — same stack as ValidationQueue / incident meter. */
export function TrustScoreInfo({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            className,
          )}
          aria-label="Trust score percentages"
          title="Trust meter"
        >
          <Shield className="size-3.5" strokeWidth={2.25} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Trust percentages</DialogTitle>
          <DialogDescription>
            How Trust % is scored for each report.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
            Trust stack · max 100
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {(
              [
                [
                  "Identity",
                  TRUST_CAPS.identity,
                  "Registered account + ID verified",
                ],
                [
                  "Contact",
                  TRUST_CAPS.contact,
                  "Phone and/or email on the report (not a person count). Phone only ≈ 7 of 15; email + phone = 15.",
                ],
                [
                  "Allow location · Mobile camera",
                  TRUST_CAPS.capture,
                  "GPS accuracy (horizontal, not elevation) + live mobile camera photo",
                ],
                [
                  "Vertex AI",
                  TRUST_CAPS.vertex,
                  "Image class + visual place from Vertex vision / AutoML",
                ],
                [
                  "Gemini",
                  TRUST_CAPS.ai,
                  "Gemini confidence after validation",
                ],
              ] as const
            ).map(([label, cap, hint]) => (
              <li
                key={label}
                className="flex items-baseline justify-between gap-3 border-b border-[var(--border)]/70 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-[var(--muted)]">{hint}</p>
                </div>
                <p className="shrink-0 font-mono text-sm tabular-nums text-[var(--accent)]">
                  {cap}%
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--muted)]">
            High ≥80 · Moderate ≥55 · Low ≥30 · else Untrusted
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
