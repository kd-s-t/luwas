import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

function statusVariant(
  status: ReportStatus,
): "default" | "outline" | "warn" | "danger" {
  if (status === "legit" || status === "dispatched" || status === "done") {
    return "default";
  }
  if (status === "rejected" || status === "failed") return "danger";
  if (
    status === "needs_review" ||
    status === "validating" ||
    status === "queued" ||
    status === "assigned"
  ) {
    return "warn";
  }
  return "outline";
}

export function statusLabel(status: ReportStatus): string {
  if (status === "legit") return "Verified";
  if (status === "needs_review") return "Needs review";
  if (status === "assigned") return "Assigned";
  if (status === "dispatched") return "Dispatched";
  if (status === "done") return "Done";
  if (status === "queued") return "Queue";
  return status.replace(/_/g, " ");
}

type ReportStatusBadgeProps = {
  status: ReportStatus;
  className?: string;
};

/** Pipeline + AI statuses for boards and detail. */
export function ReportStatusBadge({ status, className }: ReportStatusBadgeProps) {
  if (status === "legit") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 border border-transparent bg-[var(--success)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-white uppercase",
          className,
        )}
      >
        <Image
          src="/brands/gemini.png"
          alt=""
          width={14}
          height={14}
          className="size-3.5 shrink-0 object-contain"
        />
        Verified
      </span>
    );
  }

  if (status === "dispatched") {
    return (
      <span
        className={cn(
          "inline-flex border border-transparent bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[var(--on-accent)] uppercase",
          className,
        )}
      >
        Dispatched
      </span>
    );
  }

  if (status === "done") {
    return (
      <span
        className={cn(
          "inline-flex border border-[var(--border)] bg-[var(--surface-panel)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase",
          className,
        )}
      >
        Done
      </span>
    );
  }

  return (
    <Badge variant={statusVariant(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
