import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/lib/reports/types";
import { cn } from "@/lib/utils";

function statusVariant(
  status: ReportStatus,
): "default" | "outline" | "warn" | "danger" {
  if (status === "legit") return "default";
  if (status === "rejected" || status === "failed") return "danger";
  if (status === "needs_review" || status === "validating" || status === "queued")
    return "warn";
  return "outline";
}

function statusLabel(status: ReportStatus): string {
  if (status === "legit") return "Verified";
  if (status === "needs_review") return "Needs review";
  return status.replace(/_/g, " ");
}

type ReportStatusBadgeProps = {
  status: ReportStatus;
  className?: string;
};

/** Shows Gemini + Verified for legit AI checks; other statuses as plain badges. */
export function ReportStatusBadge({ status, className }: ReportStatusBadgeProps) {
  if (status === "legit") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 border border-transparent bg-[var(--accent)] px-2 py-0.5 font-mono text-[10px] tracking-wider text-[var(--on-accent)] uppercase",
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

  return (
    <Badge variant={statusVariant(status)} className={className}>
      {statusLabel(status)}
    </Badge>
  );
}
