"use client";

import { List } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  reportPriorityLabel,
  type ReportPriority,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";

const PRIORITY_GUIDE: {
  priority: ReportPriority;
  meaning: string;
}[] = [
  {
    priority: "critical",
    meaning:
      "Life-safety now and/or many people with poor access or weak coverage. Act first.",
  },
  {
    priority: "high",
    meaning:
      "Urgent need, clear impact, feasible response. Handle soon after P1.",
  },
  {
    priority: "medium",
    meaning:
      "Real need but limited scale or incomplete evidence. Plan and verify.",
  },
  {
    priority: "low",
    meaning:
      "Minor, weak signal, or insufficient evidence. Monitor; do not divert scarce resources.",
  },
];

const FACTORS = [
  "Immediate severity — verified life-safety or health risk?",
  "People affected — how many need help, and for how long?",
  "Existing coverage — usable stock the community already has",
  "Delivery feasibility — can responders or supplies reach the place?",
  "Evidence quality — verified, estimated, or conflicting?",
] as const;

function priorityTone(priority: ReportPriority) {
  if (priority === "critical") {
    return "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/25";
  }
  if (priority === "high") {
    return "bg-[#fff7ed] text-[#c2410c] ring-[#fdba74]/70";
  }
  if (priority === "medium") {
    return "bg-[#eff6ff] text-[#2f5f9e] ring-[#93c5fd]/70";
  }
  return "bg-[var(--foreground)]/6 text-[var(--muted)] ring-[var(--border)]";
}

/** How P1–P4 priorities are scored — reference for officers. */
export function CriticalInfo({ className }: { className?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--border)] text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]",
            className,
          )}
          aria-label="Priority meanings"
          title="Priority meanings"
        >
          <List className="size-3.5" strokeWidth={2.25} />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Priority meanings</DialogTitle>
          <DialogDescription>
            How Gemini (or local rules) ranks incidents for responders.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
            P1–P4 · resource allocation
          </p>
          <ul className="space-y-2 text-sm">
            {PRIORITY_GUIDE.map(({ priority, meaning }) => (
              <li
                key={priority}
                className="flex items-start justify-between gap-3 border-b border-[var(--border)]/70 pb-2 last:border-0 last:pb-0"
              >
                <div className="min-w-0">
                  <span
                    className={cn(
                      "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1",
                      priorityTone(priority),
                    )}
                  >
                    {reportPriorityLabel(priority)}
                  </span>
                  <p className="mt-1.5 text-xs text-[var(--muted)]">{meaning}</p>
                </div>
              </li>
            ))}
          </ul>
          <div>
            <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Scored from
            </p>
            <ul className="mt-1.5 space-y-1 text-xs text-[var(--muted)]">
              {FACTORS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-[var(--muted)]">
            Priority is a proposal only. Officers still verify before dispatch.
          </p>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
