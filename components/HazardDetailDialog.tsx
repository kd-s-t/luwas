"use client";

import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type HazardDetail = {
  title: string;
  severityLabel?: string;
  severityTone?: "danger" | "warn" | "muted" | "accent";
  place?: string;
  purokHint?: string;
  notes?: string;
  mediaUrl?: string;
  meta: { label: string; value: string }[];
  externalUrl?: string;
  externalLabel?: string;
};

const TONE: Record<NonNullable<HazardDetail["severityTone"]>, string> = {
  danger: "text-[var(--danger)]",
  warn: "text-[var(--warn)]",
  muted: "text-[var(--muted)]",
  accent: "text-[var(--accent)]",
};

type Props = {
  detail: HazardDetail | null;
  onClose: () => void;
};

export function HazardDetailDialog({ detail, onClose }: Props) {
  return (
    <Dialog
      open={detail != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        {detail ? (
          <>
            <DialogHeader>
              {detail.severityLabel ? (
                <p
                  className={`font-mono text-[10px] tracking-[0.18em] uppercase ${
                    TONE[detail.severityTone ?? "muted"]
                  }`}
                >
                  {detail.severityLabel}
                </p>
              ) : null}
              <DialogTitle className="font-[family-name:var(--font-display)] text-xl tracking-wide">
                {detail.title}
              </DialogTitle>
              {(detail.place || detail.purokHint) && (
                <DialogDescription>
                  {[detail.place, detail.purokHint].filter(Boolean).join(" · ")}
                </DialogDescription>
              )}
            </DialogHeader>
            <DialogBody className="space-y-4">
              {detail.mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.mediaUrl}
                  alt={detail.title}
                  className="max-h-56 w-full border border-[var(--border)] object-cover"
                />
              ) : null}
              {detail.notes ? (
                <p className="text-sm text-[var(--foreground)]">{detail.notes}</p>
              ) : null}
              <dl className="grid gap-2 border border-[var(--border)] bg-[var(--surface-panel)]/40 px-3 py-2.5">
                {detail.meta.map((row) => (
                  <div
                    key={row.label}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
                  >
                    <dt className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      {row.label}
                    </dt>
                    <dd className="text-right text-[var(--foreground)]">
                      {row.value}
                    </dd>
                  </div>
                ))}
              </dl>
              {detail.externalUrl ? (
                <a
                  href={detail.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex font-mono text-[11px] tracking-wider text-[var(--accent)] uppercase underline-offset-2 hover:underline"
                >
                  {detail.externalLabel ?? "Open source"}
                </a>
              ) : null}
            </DialogBody>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function formatHazardWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
