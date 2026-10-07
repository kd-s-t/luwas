"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { submitSupportTicket } from "@/lib/support/api";

export function SupportBugForm() {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [summary, setSummary] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPageUrl(document.referrer || window.location.origin);
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      setError("Sign in to send a bug report.");
      return;
    }
    setBusy(true);
    setError(null);
    setDone(false);
    try {
      await submitSupportTicket({
        email: email || user.email || "",
        pageUrl,
        summary,
        details,
        uid: user.uid,
      });
      setDone(true);
      setSummary("");
      setDetails("");
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
          htmlFor="support-url"
          className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase"
        >
          Page URL
        </label>
        <input
          id="support-url"
          type="url"
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          disabled={busy}
          placeholder="https://…"
          className="mt-1.5 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 font-mono text-xs outline-none focus:border-[var(--accent)]"
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
          className="mt-1.5 w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {done ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          Thanks — your bug report was sent.
        </p>
      ) : null}

      <Button type="submit" disabled={busy || !summary.trim()}>
        {busy ? "Sending…" : "Send bug report"}
      </Button>
    </form>
  );
}
