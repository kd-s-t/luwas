"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ImagePlus, Loader2, MapPin, MonitorSmartphone, Upload } from "lucide-react";
import { isCitizen, isOfficer, type UserProfile } from "@/lib/auth/types";
import {
  captureReportMeta,
  isMobileClient,
  readDeviceLabel,
  type ReportCaptureMeta,
} from "@/lib/reports/captureMeta";
import {
  createHazardReport,
  markReportValidating,
  updateReportValidation,
} from "@/lib/reports/api";
import type { ReportHazardHint } from "@/lib/reports/types";
import { takePendingReportMedia } from "@/lib/reports/pendingMedia";
import { fileToBase64, uploadReportMedia } from "@/lib/reports/upload";
import { Button } from "@/components/ui/button";

type CitizenReportFormProps = {
  /** Any signed-in poster — citizen or officer. */
  author: UserProfile;
};

function authorPlace(profile: UserProfile): string {
  if (isCitizen(profile)) return profile.purok;
  if (isOfficer(profile)) return profile.orgName;
  return "Field";
}

const HAZARDS: { id: ReportHazardHint; label: string }[] = [
  { id: "flood", label: "Flood" },
  { id: "landslide", label: "Landslide" },
  { id: "typhoon", label: "Typhoon / wind" },
  { id: "fire", label: "Fire" },
  { id: "other", label: "Other" },
];

export function CitizenReportForm({ author }: CitizenReportFormProps) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [hazardHint, setHazardHint] = useState<ReportHazardHint>("flood");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [meta, setMeta] = useState<ReportCaptureMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [mobileCapture, setMobileCapture] = useState(false);

  useEffect(() => {
    setMobileCapture(isMobileClient());
    const pending = takePendingReportMedia();
    if (pending) {
      setFile(pending);
      setPreview(URL.createObjectURL(pending));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setMetaLoading(true);
    void captureReportMeta().then((next) => {
      if (!cancelled) {
        setMeta(next);
        setMetaLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onFile(next: File | null) {
    setFile(next);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return next ? URL.createObjectURL(next) : null;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!file || submitting) return;
    setError(null);
    setStatus("Capturing location & device…");
    setSubmitting(true);

    const reportId = crypto.randomUUID();
    const mediaType = file.type.startsWith("video/") ? "video" : "photo";

    try {
      const captured = meta ?? (await captureReportMeta());
      setMeta(captured);

      setStatus("Uploading media…");
      const uploaded = await uploadReportMedia({
        citizenUid: author.uid,
        reportId,
        file,
      });

      setStatus("Queued for AI validation…");
      const id = await createHazardReport({
        id: reportId,
        citizenUid: author.uid,
        citizenName: author.displayName,
        citizenPurok: authorPlace(author),
        citizenPhotoURL: author.photoURL ?? null,
        title: title.trim(),
        notes: notes.trim(),
        hazardHint,
        mediaType,
        mediaPath: uploaded.mediaPath,
        mediaUrl: uploaded.mediaUrl,
        mediaMime: uploaded.mediaMime,
        mediaSource: mobileCapture ? "mobile-camera" : "desktop-file",
        lat: captured.lat,
        lng: captured.lng,
        locationAccuracyM: captured.locationAccuracyM,
        locationLabel: captured.locationLabel,
        device: captured.device,
        ipAddress: captured.ipAddress,
      });

      await markReportValidating(id);
      setStatus("Gemini verifying…");

      const canInline =
        mediaType === "photo" && file.size <= 3.5 * 1024 * 1024;
      const mediaBase64 = canInline ? await fileToBase64(file) : undefined;
      const res = await fetch("/api/ai/validate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim(),
          hazardHint,
          mediaType,
          mediaMime: uploaded.mediaMime,
          mediaBase64,
          fileName: file.name,
        }),
      });

      if (!res.ok) {
        throw new Error(`Validation failed (${res.status})`);
      }

      const data = (await res.json()) as {
        status: "legit" | "rejected" | "needs_review";
        verdict: "legit" | "rejected" | "needs_review";
        confidence: number;
        reason: string;
        source: "gemini" | "local";
        model?: string;
      };

      await updateReportValidation(id, {
        status: data.status,
        aiVerdict: data.verdict,
        aiConfidence: data.confidence,
        aiReason: data.reason,
        aiSource: data.source,
        aiModel: data.model ?? null,
        validatedAt: new Date().toISOString(),
      });

      setStatus(
        data.verdict === "legit"
          ? "Verified by Gemini — officers can use this in the queue."
          : data.verdict === "rejected"
            ? "Flagged as not verified / spam."
            : "Needs officer review.",
      );
      setTitle("");
      setNotes("");
      onFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit report");
      setStatus(null);
    } finally {
      setSubmitting(false);
    }
  }

  const deviceLine = meta?.device ?? readDeviceLabel();
  const locationLine = metaLoading
    ? "Getting GPS…"
    : (meta?.locationLabel ?? "Location unavailable");
  const ipLine = metaLoading
    ? "Getting IP…"
    : (meta?.ipAddress ?? "IP unavailable");

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div>
        <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Field report
        </p>
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
          What’s happening?
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {mobileCapture
            ? "Live field capture — photo or short video, then fill details and submit."
            : "Upload a photo or short video from this computer, then fill details and submit."}
        </p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-4 py-6 transition hover:border-[var(--accent)]">
        <input
          type="file"
          accept="image/*,video/*"
          // Mobile: rear camera. Desktop: file picker only (no live capture).
          {...(mobileCapture ? { capture: "environment" as const } : {})}
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {preview && file?.type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Preview"
            className="mb-3 max-h-40 object-contain"
          />
        ) : preview && file?.type.startsWith("video/") ? (
          <video src={preview} className="mb-3 max-h-40" controls muted />
        ) : (
          <ImagePlus className="mb-2 size-8 text-[var(--accent)]" aria-hidden />
        )}
        <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          {file
            ? file.name
            : mobileCapture
              ? "Take photo or video now"
              : "Add photo or video"}
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Title</span>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Flooding on Purok 2 road"
          className="w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-[var(--muted)]">Details</span>
        <textarea
          required
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Depth, blocked roads, people affected…"
          className="w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 outline-none focus:border-[var(--accent)]"
        />
      </label>

      <fieldset>
        <legend className="mb-1.5 text-sm text-[var(--muted)]">Hazard type</legend>
        <div className="flex flex-wrap gap-1.5">
          {HAZARDS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setHazardHint(h.id)}
              className={`border px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition ${
                hazardHint === h.id
                  ? "border-[var(--accent)] bg-[var(--accent)] text-[var(--on-accent)]"
                  : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)]"
              }`}
            >
              {h.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--muted)] uppercase">
          Auto metadata · not editable
        </p>
        <ul className="mt-2 space-y-1.5 text-sm text-[var(--foreground)]">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
            <span>
              <span className="text-[var(--muted)]">Location · </span>
              {locationLine}
            </span>
          </li>
          <li className="flex items-start gap-2">
            <MonitorSmartphone className="mt-0.5 size-3.5 shrink-0 text-[var(--accent)]" />
            <span>
              <span className="text-[var(--muted)]">Device · </span>
              {deviceLine}
              <span className="text-[var(--muted)]">
                {" "}
                · {mobileCapture ? "field camera" : "desk upload"}
              </span>
            </span>
          </li>
          <li className="flex items-start gap-2 font-mono text-xs tracking-wide">
            <span className="mt-0.5 inline-block w-3.5 shrink-0 text-center text-[var(--accent)]">
              IP
            </span>
            <span>
              <span className="font-sans text-sm text-[var(--muted)]">
                IP ·{" "}
              </span>
              {ipLine}
            </span>
          </li>
        </ul>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          {status}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting || !file || !title.trim()}>
        {submitting ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Upload className="size-4" aria-hidden />
        )}
        {submitting ? "Submitting…" : "Submit to AI queue"}
      </Button>
    </form>
  );
}
