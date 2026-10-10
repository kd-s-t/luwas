"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMAIL_TEMPLATE_CATEGORIES,
  EMAIL_TEMPLATES,
  type EmailTemplateId,
} from "@/lib/email/registry";
import { TextMessagePreview } from "@/components/TextMessagePreview";
import { cn } from "@/lib/utils";

type EmailPreview = {
  subject: string;
  from: string;
  html: string;
};

type TextPreview = {
  to: string;
  body: string;
  segments: number;
  chars: number;
};

function EmailHtmlFrame({ html, title }: { html: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);

  const resize = useCallback(() => {
    const frame = ref.current;
    if (!frame) return;
    try {
      const doc = frame.contentDocument;
      if (!doc?.body) return;
      const h = Math.max(
        doc.body.scrollHeight,
        doc.documentElement?.scrollHeight ?? 0,
        280,
      );
      // Full email height — no cap, so footer stays visible.
      frame.style.height = `${h}px`;
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return;

    let ro: ResizeObserver | null = null;
    const attach = () => {
      resize();
      const body = frame.contentDocument?.body;
      if (!(body instanceof Element)) return;
      ro?.disconnect();
      ro = new ResizeObserver(resize);
      ro.observe(body);
      // Maps / images load late — remeasure a few times.
      window.setTimeout(resize, 300);
      window.setTimeout(resize, 1000);
    };

    frame.addEventListener("load", attach);
    attach();
    return () => {
      frame.removeEventListener("load", attach);
      ro?.disconnect();
    };
  }, [html, resize]);

  return (
    <iframe
      ref={ref}
      title={title}
      srcDoc={html}
      onLoad={resize}
      className="block w-full border-0 bg-[var(--surface-panel)]"
      sandbox="allow-same-origin"
      scrolling="no"
    />
  );
}

/** Template tree nested under the Email & text left-nav accordion. */
export function BootstrapTemplateNav({
  selectedId,
  onSelect,
}: {
  selectedId: EmailTemplateId;
  onSelect: (id: EmailTemplateId) => void;
}) {
  return (
    <div className="ml-2 space-y-2 border-l border-[var(--border)] py-1 pl-1">
      {EMAIL_TEMPLATE_CATEGORIES.map((cat) => {
        const items = EMAIL_TEMPLATES.filter((t) => t.category === cat.id);
        return (
          <div key={cat.id}>
            <p className="px-2.5 py-1 font-mono text-[9px] tracking-[0.16em] text-[var(--muted)]/80 uppercase">
              {cat.label}
            </p>
            <ul>
              {items.map((tpl) => {
                const active = selectedId === tpl.id;
                return (
                  <li key={tpl.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(tpl.id)}
                      className={cn(
                        "flex w-full cursor-pointer items-center border-l-2 bg-transparent px-2.5 py-1.5 text-left font-mono text-[10px] leading-tight tracking-wider uppercase transition",
                        active
                          ? "border-[var(--accent)] bg-[var(--surface-panel)]/60 text-[var(--foreground)]"
                          : "border-transparent text-[var(--muted)] hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]/60 hover:text-[var(--foreground)]",
                      )}
                    >
                      {tpl.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export function BootstrapEmailTemplates({
  selectedId,
}: {
  selectedId: EmailTemplateId;
}) {
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [textPreview, setTextPreview] = useState<TextPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(
    () => EMAIL_TEMPLATES.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const q = encodeURIComponent(selectedId);
    void Promise.all([
      fetch(`/api/command/email-templates?template=${q}`),
      fetch(`/api/command/text-templates?template=${q}`),
    ])
      .then(async ([emailRes, textRes]) => {
        if (!emailRes.ok) throw new Error("Preview failed");
        const emailJson = (await emailRes.json()) as { preview: EmailPreview };
        if (cancelled) return;
        setEmailPreview(emailJson.preview);
        if (textRes.ok) {
          const textJson = (await textRes.json()) as { preview: TextPreview };
          if (!cancelled) setTextPreview(textJson.preview);
        } else if (!cancelled) {
          setTextPreview(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEmailPreview(null);
          setTextPreview(null);
          setError(err instanceof Error ? err.message : "Preview failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  return (
    <div className="min-w-0 border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-4">
      {selected ? (
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
              {selected.name}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {selected.description}
            </p>
            <p className="mt-1 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              {selected.id}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <a
              href={`/api/email/offline-kit?template=${encodeURIComponent(selected.id)}&print=0`}
              target="_blank"
              rel="noreferrer"
              className="border border-[var(--border)] px-3 py-2 text-sm text-[var(--muted)] transition hover:border-[var(--accent)]/40 hover:text-[var(--foreground)]"
            >
              Open kit
            </a>
            <a
              href={`/api/email/offline-kit?template=${encodeURIComponent(selected.id)}`}
              target="_blank"
              rel="noreferrer"
              className="bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
            >
              Download PDF
            </a>
          </div>
        </header>
      ) : null}

      {error ? (
        <p className="mt-3 text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      {loading && !emailPreview ? (
        <p className="mt-4 font-mono text-xs text-[var(--muted)]">
          Loading preview…
        </p>
      ) : null}

      {emailPreview ? (
        <div className="mt-4 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(248px,280px)] xl:items-start">
          <section className="min-w-0 space-y-2">
            <h3 className="font-mono text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
              Email
            </h3>
            <p className="text-xs text-[var(--muted)]">
              <span className="font-mono tracking-wider uppercase">From</span>{" "}
              {emailPreview.from}
            </p>
            <p className="text-sm font-medium">{emailPreview.subject}</p>
            <div className="overflow-hidden border border-[var(--border)]">
              <EmailHtmlFrame
                html={emailPreview.html}
                title={selected?.name ?? "Email preview"}
              />
            </div>
          </section>

          <section className="min-w-0">
            <h3 className="mb-3 font-mono text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
              Text
            </h3>
            {textPreview ? (
              <TextMessagePreview preview={textPreview} />
            ) : (
              <p className="border border-dashed border-[var(--border)] px-3 py-6 text-sm text-[var(--muted)]">
                Email-only — no SMS twin.
              </p>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
