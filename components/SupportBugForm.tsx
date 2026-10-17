"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { submitSupportTicket } from "@/lib/support/api";
import {
  isSupportMediaFile,
  isSupportVideoUrl,
  supportMediaLimit,
  uploadSupportMedia,
} from "@/lib/support/upload";

type SupportBugFormProps = {
  /** Called after a successful submit (e.g. return to My support). */
  onSubmitted?: () => void;
};

export function SupportBugForm({ onSubmitted }: SupportBugFormProps) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [files]);

  function onPickFiles(list: FileList | null) {
    if (!list) return;
    const next = [...files];
    for (const file of Array.from(list)) {
      if (!isSupportMediaFile(file)) continue;
      if (next.length >= supportMediaLimit()) break;
      next.push(file);
    }
    setFiles(next);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      const uid = user?.uid || "guest";
      const mediaUrls: string[] = [];
      for (const file of files) {
        const up = await uploadSupportMedia({ uid, file });
        mediaUrls.push(up.mediaUrl);
      }
      await submitSupportTicket({
        email: email || user?.email || "",
        pageUrl:
          typeof window !== "undefined" ? window.location.href.slice(0, 500) : "",
        summary,
        details,
        uid,
        mediaUrls,
      });
      setDone(true);
      setSummary("");
      setDetails("");
      setFiles([]);
      onSubmitted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 border border-[var(--border)] bg-[var(--surface)] px-4 py-5 sm:px-5"
    >
      <div>
        <label
          htmlFor="support-email"
          className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase"
        >
          Email (optional)
        </label>
        <input
          id="support-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
          placeholder="so we can follow up"
          className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <label
          htmlFor="support-summary"
          className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase"
        >
          Summary
        </label>
        <input
          id="support-summary"
          required
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={busy}
          maxLength={200}
          placeholder="Short description of the bug"
          aria-invalid={!!error}
          aria-describedby={error ? "support-form-error" : undefined}
          className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <label
          htmlFor="support-details"
          className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase"
        >
          What happened
        </label>
        <textarea
          id="support-details"
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={busy}
          rows={5}
          maxLength={4000}
          placeholder="Steps to reproduce, what you expected, and what you saw…"
          aria-invalid={!!error}
          aria-describedby={error ? "support-form-error" : undefined}
          className="mt-1.5 w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      <div>
        <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          Screenshots or video (optional, up to {supportMediaLimit()})
        </p>
        {previews.length > 0 ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {previews.map((src, i) => {
              const file = files[i];
              const video =
                file?.type.startsWith("video/") ||
                (file ? isSupportVideoUrl(file.name) : false);
              return (
                <li key={`${src}-${i}`} className="relative">
                  {video ? (
                    <video
                      src={src}
                      className="h-20 w-28 border border-[var(--border)] object-cover"
                      muted
                      playsInline
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt=""
                      className="h-20 w-20 border border-[var(--border)] object-cover"
                    />
                  )}
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeFile(i)}
                    className="absolute top-0.5 right-0.5 bg-black/70 px-1.5 text-[10px] text-white"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
        {files.length < supportMediaLimit() ? (
          <label className="mt-2 inline-flex cursor-pointer border border-dashed border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--foreground)]">
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              disabled={busy}
              className="sr-only"
              onChange={(e) => {
                onPickFiles(e.target.files);
                e.target.value = "";
              }}
            />
            Add photo or video
          </label>
        ) : null}
      </div>

      {error ? (
        <p
          id="support-form-error"
          className="text-sm text-[var(--danger)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          Thanks. Sent to UGNAI developers. They will follow up if needed.
        </p>
      ) : null}

      <Button type="submit" disabled={busy || !summary.trim()}>
        {busy ? "Sending…" : "Send to developers"}
      </Button>
    </form>
  );
}
