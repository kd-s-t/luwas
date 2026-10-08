"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isEmailTemplateId,
  type EmailTemplateCategory,
  type EmailTemplateId,
  type EmailTemplateMeta,
} from "@/lib/email/registry";
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

type CatalogPayload = {
  categories: { id: EmailTemplateCategory; label: string }[];
  templates: EmailTemplateMeta[];
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
        320,
      );
      frame.style.height = `${h}px`;
    } catch {
      // leave default height
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
    };

    attach();
    frame.addEventListener("load", attach);
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
      className="block w-full border-0 bg-[#e8f5ee]"
      sandbox="allow-same-origin"
      scrolling="no"
    />
  );
}

function PhoneBubble({ preview }: { preview: TextPreview }) {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="rounded-[1.75rem] border border-[var(--border)] bg-[#0f2a1c] p-3 shadow-lg">
        <div className="mb-3 flex items-center justify-between px-2">
          <p className="font-mono text-[10px] tracking-wider text-white/50 uppercase">
            Messages
          </p>
          <p className="font-mono text-[10px] text-white/40">Luwas</p>
        </div>
        <div className="min-h-[200px] rounded-2xl bg-[#1a3d2a] px-3 py-4">
          <div className="mb-3 text-center">
            <p className="text-xs font-medium text-white/70">Luwas Alerts</p>
            <p className="font-mono text-[10px] text-white/40">{preview.to}</p>
          </div>
          <div className="ml-auto max-w-[92%] rounded-2xl rounded-br-md bg-[var(--accent)] px-3.5 py-2.5 text-[13px] leading-relaxed text-white shadow-sm">
            {preview.body}
          </div>
          <p className="mt-2 text-right font-mono text-[9px] text-white/35">
            {preview.chars} chars · {preview.segments} seg
          </p>
        </div>
      </div>
    </div>
  );
}

export function AlertTemplatesPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const templateParam = searchParams.get("template");

  const [data, setData] = useState<CatalogPayload | null>(null);
  const [selectedId, setSelectedId] = useState<EmailTemplateId | null>(() =>
    templateParam && isEmailTemplateId(templateParam) ? templateParam : null,
  );
  const [emailPreview, setEmailPreview] = useState<EmailPreview | null>(null);
  const [textPreview, setTextPreview] = useState<TextPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectTemplate = useCallback(
    (id: EmailTemplateId, replace = false) => {
      setSelectedId(id);
      const params = new URLSearchParams(searchParams.toString());
      params.set("template", id);
      const href = `${pathname}?${params.toString()}`;
      if (replace) router.replace(href, { scroll: false });
      else router.push(href, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/command/email-templates");
        if (!res.ok) throw new Error("Could not load templates");
        const json = (await res.json()) as CatalogPayload;
        if (cancelled) return;
        setData(json);
        const fromUrl =
          templateParam && isEmailTemplateId(templateParam)
            ? templateParam
            : null;
        const fallback = json.templates[0]?.id ?? null;
        const next = fromUrl ?? fallback;
        if (!next) return;
        if (fromUrl) setSelectedId(fromUrl);
        else selectTemplate(next, true);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load templates",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data) return;
    if (!templateParam || !isEmailTemplateId(templateParam)) return;
    if (templateParam !== selectedId) setSelectedId(templateParam);
  }, [data, templateParam, selectedId]);

  const loadPreview = useCallback(async (templateId: EmailTemplateId) => {
    setLoadingPreview(true);
    setError(null);
    try {
      const q = encodeURIComponent(templateId);
      const [emailRes, textRes] = await Promise.all([
        fetch(`/api/command/email-templates?template=${q}`),
        fetch(`/api/command/text-templates?template=${q}`),
      ]);
      if (!emailRes.ok || !textRes.ok) throw new Error("Could not load preview");
      const emailJson = (await emailRes.json()) as { preview: EmailPreview };
      const textJson = (await textRes.json()) as { preview: TextPreview };
      setEmailPreview(emailJson.preview);
      setTextPreview(textJson.preview);
    } catch (err) {
      setEmailPreview(null);
      setTextPreview(null);
      setError(err instanceof Error ? err.message : "Could not load preview");
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    void loadPreview(selectedId);
  }, [selectedId, loadPreview]);

  const templatesByCategory = useMemo(() => {
    if (!data) return new Map<EmailTemplateCategory, EmailTemplateMeta[]>();
    const map = new Map<EmailTemplateCategory, EmailTemplateMeta[]>();
    for (const cat of data.categories) {
      map.set(
        cat.id,
        data.templates.filter((t) => t.category === cat.id),
      );
    }
    return map;
  }, [data]);

  const selected = data?.templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)] lg:gap-8">
      <nav className="space-y-5 lg:sticky lg:top-6 lg:self-start">
        {data?.categories.map((cat) => {
          const items = templatesByCategory.get(cat.id) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={cat.id}>
              <p className="px-1 font-mono text-[10px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                {cat.label}
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {items.map((item) => {
                  const active = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectTemplate(item.id)}
                        className={cn(
                          "w-full rounded-lg px-3 py-2 text-left text-sm transition",
                          active
                            ? "bg-[var(--accent)]/15 font-medium text-[var(--foreground)]"
                            : "text-[var(--muted)] hover:bg-[var(--accent)]/[0.06] hover:text-[var(--foreground)]",
                        )}
                      >
                        {item.name}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="min-w-0">
        {selected ? (
          <>
            <header className="mb-5">
              <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--foreground)] sm:text-2xl">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selected.description}
              </p>
            </header>

            {error ? (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            ) : loadingPreview ? (
              <p className="text-sm text-[var(--muted)]">Loading preview…</p>
            ) : emailPreview && textPreview ? (
              <div className="grid gap-6 xl:grid-cols-2 xl:gap-8">
                <section className="min-w-0">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-mono text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
                      Email
                    </h3>
                    <p className="truncate text-xs text-[var(--muted)]">
                      Resend
                    </p>
                  </div>
                  <dl className="mb-3 space-y-1 text-sm">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">
                        From
                      </dt>
                      <dd className="min-w-0 break-all text-[var(--foreground)]/80">
                        {emailPreview.from}
                      </dd>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">
                        Subject
                      </dt>
                      <dd className="min-w-0 font-medium text-[var(--foreground)]">
                        {emailPreview.subject}
                      </dd>
                    </div>
                  </dl>
                  <div className="overflow-hidden rounded-xl border border-[var(--border)]">
                    <EmailHtmlFrame
                      html={emailPreview.html}
                      title={emailPreview.subject}
                    />
                  </div>
                </section>

                <section className="min-w-0">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="font-mono text-[10px] font-semibold tracking-wider text-[var(--muted)] uppercase">
                      Text
                    </h3>
                    <p className="truncate text-xs text-[var(--muted)]">
                      Twilio · {textPreview.chars} chars ·{" "}
                      {textPreview.segments} seg
                    </p>
                  </div>
                  <dl className="mb-3 space-y-1 text-sm">
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                      <dt className="font-mono text-[10px] text-[var(--muted)] uppercase">
                        To
                      </dt>
                      <dd className="min-w-0 break-all text-[var(--foreground)]/80">
                        {textPreview.to}
                      </dd>
                    </div>
                  </dl>
                  <PhoneBubble preview={textPreview} />
                </section>
              </div>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            {error ?? "Select a template to preview."}
          </p>
        )}
      </div>
    </div>
  );
}
