"use client";

import { useEffect, useState } from "react";
import { Camera, IdCard, ShieldCheck, UserRound } from "lucide-react";
import {
  ACCEPTED_ID_TYPES,
  type AcceptedIdType,
} from "@/lib/auth/idTypes";
import { cn } from "@/lib/utils";

export type IdCaptureState = {
  idType: AcceptedIdType;
  idFile: File | null;
  faceFile: File | null;
};

type IdVerificationCaptureProps = {
  value: IdCaptureState;
  onChange: (next: IdCaptureState) => void;
  disabled?: boolean;
};

function Preview({
  file,
  label,
  capture,
  onPick,
  disabled,
  icon,
}: {
  file: File | null;
  label: string;
  capture: "environment" | "user";
  onPick: (file: File | null) => void;
  disabled?: boolean;
  icon: React.ReactNode;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(file);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);

  return (
    <label
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-3 py-4 transition hover:border-[var(--accent)]",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <input
        type="file"
        accept="image/*"
        capture={capture}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="mb-2 max-h-36 w-full object-contain"
        />
      ) : (
        <span className="mb-2 text-[var(--accent)]">{icon}</span>
      )}
      <span className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
        <Camera className="size-3" aria-hidden />
        {file ? file.name.slice(0, 28) : label}
      </span>
    </label>
  );
}

export function IdVerificationCapture({
  value,
  onChange,
  disabled,
}: IdVerificationCaptureProps) {
  return (
    <fieldset className="space-y-3 border border-[var(--border)] bg-[var(--surface-panel)]/50 p-3">
      <legend className="flex items-center gap-1.5 px-1 font-mono text-[10px] tracking-[0.18em] text-[var(--accent)] uppercase">
        <ShieldCheck className="size-3.5" aria-hidden />
        ID validation
      </legend>
      <p className="text-xs text-[var(--muted)]">
        Capture your government ID and a clear face selfie. Accepted: Driver’s
        License, Passport, or UMID (not PhilPost / National ID for now).
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ACCEPTED_ID_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange({ ...value, idType: t.id })}
            className={cn(
              "border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition",
              value.idType === t.id
                ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Preview
          file={value.idFile}
          label="Take / upload ID"
          capture="environment"
          disabled={disabled}
          icon={<IdCard className="size-8" aria-hidden />}
          onPick={(idFile) => onChange({ ...value, idFile })}
        />
        <Preview
          file={value.faceFile}
          label="Take / upload face"
          capture="user"
          disabled={disabled}
          icon={<UserRound className="size-8" aria-hidden />}
          onPick={(faceFile) => onChange({ ...value, faceFile })}
        />
      </div>
    </fieldset>
  );
}
