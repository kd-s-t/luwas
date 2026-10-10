"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUp, ChevronDown, History, Plus } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import {
  BootstrapEmailTemplates,
  BootstrapTemplateNav,
} from "@/components/BootstrapEmailTemplates";
import { HomeFooter } from "@/components/HomeFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { easeOut } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import type { EmailTemplateId } from "@/lib/email/registry";
import { cn } from "@/lib/utils";

const TOC = [
  { id: "logo", label: "Logo" },
  { id: "qr", label: "QR + logo" },
  { id: "colors", label: "Theme color" },
  { id: "email", label: "Email & text" },
  { id: "header", label: "Header" },
  { id: "stack", label: "Stack" },
  { id: "type", label: "Typography" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Forms" },
  { id: "badges", label: "Badges" },
  { id: "alerts", label: "Alerts" },
  { id: "list", label: "List" },
  { id: "table", label: "Table" },
  { id: "chat", label: "Chat" },
  { id: "map", label: "Map chips" },
] as const;

const STACK = [
  {
    name: "Tailwind CSS",
    href: "https://tailwindcss.com/",
    role: "Utility styling",
  },
  {
    name: "shadcn/ui",
    href: "https://ui.shadcn.com/",
    role: "Dialog, button, badge",
  },
  {
    name: "Lucide",
    href: "https://lucide.dev/",
    role: "Icons",
  },
  {
    name: "Framer Motion",
    href: "https://www.framer.com/motion/",
    role: "Motion",
  },
] as const;

const COLORS = [
  { name: "Accent", token: "--accent", hex: "#c72929" },
  { name: "Accent dim", token: "--accent-dim", hex: "#9e1a1a" },
  { name: "Foreground", token: "--foreground", hex: "#1f2126" },
  { name: "Muted", token: "--muted", hex: "#666e78" },
  { name: "Border", token: "--border", hex: "#dbe0e6" },
  { name: "Surface", token: "--surface", hex: "#ffffff" },
  { name: "Surface raised", token: "--surface-raised", hex: "#f7f7fa" },
  { name: "Surface panel", token: "--surface-panel", hex: "#eef0f3" },
  { name: "Warn", token: "--warn", hex: "#b8860b" },
  { name: "Danger", token: "--danger", hex: "#c72929" },
] as const;

const SUGGESTIONS = [
  "A typhoon cat 5 is coming in 3 days — what do we do?",
  "Run triage",
  "What do the red yellow and blue mean?",
] as const;

const HAZARD_ROWS = [
  {
    severity: "Critical",
    tone: "danger" as const,
    title: "Street flood · eastern Access Road · 85 cm",
    meta: "Purok 6",
  },
  {
    severity: "Warning",
    tone: "warn" as const,
    title: "Ponding · Purok Singko · 40 cm",
    meta: "Purok 5",
  },
  {
    severity: "Watch",
    tone: "muted" as const,
    title: "Barangay hall approach · 15 cm",
    meta: "Purok 1",
  },
] as const;

const NAV_LINKS = [
  { href: "/command", label: "Command center" },
  { href: "/command/reports", label: "Field reports" },
  { href: "/command/households", label: "House owners" },
  { href: "/bootstrap#email", label: "Templates" },
  { href: "/barangays", label: "Barangays" },
  { href: "/bootstrap", label: "Bootstrap" },
] as const;

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 border border-[var(--border)] bg-[var(--surface-raised)]/95 p-4 sm:p-5"
    >
      <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
        {title}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function BootstrapKitPage() {
  const reduce = useReducedMotion();
  const { profile, user, logout } = useAuth();
  const [templateId, setTemplateId] =
    useState<EmailTemplateId>("typhoon_alert");
  const [emailNavOpen, setEmailNavOpen] = useState(true);
  const [draft, setDraft] = useState("");
  const [chat, setChat] = useState<{ role: "ai" | "user"; text: string }[]>([
    {
      role: "ai",
      text: "Kumusta — I’m Mangluluwas. Ask about Odette triage, flood belts, or who to call. Red = evacuate, yellow = prepare, blue = flood footprints.",
    },
  ]);

  function selectTemplate(id: EmailTemplateId) {
    setTemplateId(id);
    if (typeof document !== "undefined") {
      document.getElementById("email")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }

  const qrSrc = useMemo(() => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(`${origin}/`)}`;
  }, []);

  function sendChat(e: FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setChat((prev) => [
      ...prev,
      { role: "user", text },
      {
        role: "ai",
        text: "Sample reply — same shell as /command Mangluluwas.",
      },
    ]);
    setDraft("");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <motion.header
        className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur"
        initial={reduce ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOut }}
      >
        <div className="flex min-h-12 w-full items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide"
          >
            LUWAS
          </Link>
          <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex">
            {NAV_LINKS.map((item) => {
              const active = item.href === "/bootstrap";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "shrink-0 border-b-2 px-2.5 py-3 font-mono text-[10px] tracking-wider uppercase transition",
                    active
                      ? "border-[var(--accent)] text-[var(--accent)]"
                      : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-3">
            <div className="hidden text-right text-sm lg:block">
              <p className="font-medium leading-tight">
                {profile?.displayName ?? user?.email ?? "Hon. Ricardo Villanueva"}
              </p>
              <p className="text-[11px] leading-tight text-[var(--muted)]">
                {isOfficer(profile)
                  ? profile.orgName
                  : "Brgy. Nangka · Punong Barangay"}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void logout()}
            >
              Logout
            </Button>
          </div>
        </div>
      </motion.header>

      <div className="w-full flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOut }}
          className="mb-8 border-b border-[var(--border)] pb-6"
        >
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-wide sm:text-4xl">
            LUWAS UI Bootstrap
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Living style guide for the product stack — not GetBootstrap. Built
            with Tailwind, shadcn/ui, Lucide, and Framer Motion.
          </p>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav
              aria-label="On this page"
              className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-1"
            >
              <p className="mb-2 px-2.5 font-mono text-[10px] tracking-[0.2em] text-[var(--muted)] uppercase">
                On this page
              </p>
              <ul className="flex flex-col">
                {TOC.map((item) => {
                  const rowClass =
                    "flex w-full items-center gap-1 border-l-2 border-transparent bg-transparent px-2.5 py-1.5 font-mono text-[10px] leading-none tracking-wider text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:bg-[var(--surface-panel)]/60 hover:text-[var(--foreground)]";

                  if (item.id === "email") {
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-expanded={emailNavOpen}
                          aria-controls="bootstrap-email-nav"
                          onClick={() => {
                            setEmailNavOpen((v) => !v);
                            document.getElementById("email")?.scrollIntoView({
                              behavior: "smooth",
                              block: "start",
                            });
                          }}
                          className={cn(
                            rowClass,
                            "cursor-pointer text-left",
                            emailNavOpen &&
                              "border-[var(--accent)] bg-[var(--surface-panel)]/60 text-[var(--foreground)]",
                          )}
                        >
                          <span className="min-w-0 flex-1">{item.label}</span>
                          <ChevronDown
                            className={cn(
                              "size-3 shrink-0 text-[var(--muted)] transition-transform duration-200",
                              emailNavOpen
                                ? "text-[var(--accent)]"
                                : "-rotate-90",
                            )}
                            aria-hidden
                          />
                        </button>
                        <div
                          id="bootstrap-email-nav"
                          role="region"
                          className={cn(
                            "grid transition-[grid-template-rows] duration-200 ease-out",
                            emailNavOpen
                              ? "grid-rows-[1fr]"
                              : "grid-rows-[0fr]",
                          )}
                        >
                          <div className="overflow-hidden">
                            <BootstrapTemplateNav
                              selectedId={templateId}
                              onSelect={selectTemplate}
                            />
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className={rowClass}>
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          <main className="flex flex-col gap-4">
            <Section
              id="logo"
              title="Logo"
              hint="LUWAS wordmark — brand mark for headers, QR, and chrome."
            >
              <div>
                <p className="font-[family-name:var(--font-display)] text-5xl font-semibold tracking-wide">
                  LUWAS
                </p>
                <p className="mt-1 font-mono text-[9px] tracking-[0.14em] text-[var(--muted)] uppercase">
                  Logistics &amp; Unified Workflow for Aid &amp; Safety
                </p>
              </div>
            </Section>

            <Section
              id="qr"
              title="QR + logo"
              hint="Public entry QR with LUWAS wordmark centered."
            >
              <div className="flex flex-wrap items-center gap-5">
                <div className="relative size-[220px] border border-[var(--border)] bg-[var(--surface)] p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrSrc}
                    alt="LUWAS home QR"
                    width={204}
                    height={204}
                    className="size-full"
                  />
                  <div className="absolute top-1/2 left-1/2 flex h-12 w-[4.75rem] -translate-x-1/2 -translate-y-1/2 items-center justify-center border-[3px] border-white bg-white px-1 shadow-[0_0_0_2px_var(--accent)]">
                    <span className="font-[family-name:var(--font-display)] text-lg font-semibold leading-none tracking-wide text-[var(--foreground)]">
                      LUWAS
                    </span>
                  </div>
                </div>
                <div>
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                    Scan to open LUWAS
                  </p>
                  <Button asChild variant="outline" size="sm" className="mt-3">
                    <Link href="/">Open public home</Link>
                  </Button>
                </div>
              </div>
            </Section>

            <Section
              id="colors"
              title="Theme color"
              hint="CSS variables from app/globals.css"
            >
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {COLORS.map((c) => (
                  <div
                    key={c.name}
                    className="overflow-hidden border border-[var(--border)] bg-[var(--surface)]"
                  >
                    <div
                      className="h-12"
                      style={{ background: c.hex }}
                    />
                    <div className="px-2 py-2">
                      <p className="text-sm font-medium">{c.name}</p>
                      <p className="font-mono text-[10px] text-[var(--muted)]">
                        {c.token} · {c.hex}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section
              id="email"
              title="Email & text templates"
              hint="Pick a template in the left nav for live email HTML and SMS phone preview."
            >
              <div className="mb-4 lg:hidden">
                <BootstrapTemplateNav
                  selectedId={templateId}
                  onSelect={selectTemplate}
                />
              </div>
              <BootstrapEmailTemplates selectedId={templateId} />
            </Section>

            <Section
              id="header"
              title="Header"
              hint="One-row command chrome — logo · nav · officer · logout."
            >
              <div className="flex items-center gap-3 overflow-x-auto border border-[var(--border)] bg-[var(--surface)] px-3">
                <span className="shrink-0 font-[family-name:var(--font-display)] text-xl font-semibold">
                  LUWAS
                </span>
                <span className="shrink-0 border-b-2 border-[var(--accent)] px-2 py-3 font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase">
                  Command center
                </span>
                <span className="shrink-0 px-2 py-3 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                  Field reports
                </span>
                <span className="ml-auto hidden text-right text-sm sm:block">
                  <span className="block font-medium">Officer name</span>
                  <span className="text-[11px] text-[var(--muted)]">Org · role</span>
                </span>
                <Button type="button" variant="outline" size="sm">
                  Logout
                </Button>
              </div>
            </Section>

            <Section
              id="stack"
              title="Stack"
              hint="Framework links for this app — Tailwind, shadcn/ui, Lucide, Framer Motion."
            >
              <ul className="grid gap-3 sm:grid-cols-2">
                {STACK.map((item) => (
                  <li key={item.name}>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-col border border-[var(--border)] bg-[var(--surface)] px-3 py-3 transition hover:border-[var(--accent)]"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                        {item.role}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="type"
              title="Typography"
              hint="Barlow Condensed · IBM Plex Sans · IBM Plex Mono"
            >
              <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-wide">
                LUWAS
              </p>
              <p className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
                Brgy. Nangka, Consolacion, Cebu
              </p>
              <p className="mt-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Switch barangay map · 1,500 homes
              </p>
            </Section>

            <Section
              id="buttons"
              title="Buttons"
              hint="shadcn Button + Lucide icons + DRRM priority styles."
            >
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm">
                  Primary
                </Button>
                <Button type="button" variant="outline" size="sm">
                  Outline
                </Button>
                <Button type="button" size="icon" aria-label="Send">
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--danger)] text-white hover:bg-[var(--danger)]/90"
                >
                  Evacuate
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--warn)] text-white hover:bg-[var(--warn)]/90"
                >
                  Prepare
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="bg-[var(--accent-dim)] text-white hover:bg-[var(--accent-dim)]/90"
                >
                  Monitor
                </Button>
              </div>
            </Section>

            <Section
              id="forms"
              title="Forms"
              hint="Native inputs styled like command / households."
            >
              <label className="block font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                Model
                <select className="mt-1.5 w-full max-w-md border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
                  <option>Gemini 3.5 Flash-Lite</option>
                  <option>Gemini 3.5 Flash</option>
                </select>
              </label>
              <textarea
                readOnly
                rows={2}
                placeholder="Ask Mangluluwas…"
                className="mt-3 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </Section>

            <Section id="badges" title="Badges" hint="shadcn Badge variants.">
              <div className="flex flex-wrap gap-2">
                <Badge variant="danger">evacuate</Badge>
                <Badge variant="warn">prepare</Badge>
                <Badge>monitor</Badge>
                <Badge variant="outline">Presence unknown</Badge>
              </div>
            </Section>

            <Section id="alerts" title="Alerts" hint="Inline ops status.">
              <div className="space-y-2">
                <p className="border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                  Flood critical · eastern Access Road · 85 cm
                </p>
                <p className="border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2 text-sm text-[var(--warn)]">
                  Weather watch · rain rising
                </p>
              </div>
            </Section>

            <Section
              id="list"
              title="List"
              hint="Hazard rows under the situation map."
            >
              <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--warn)] uppercase">
                Floods
              </p>
              <ul className="mt-2 divide-y divide-[var(--border)] border border-[var(--border)]">
                {HAZARD_ROWS.map((row) => (
                  <li key={row.title}>
                    <button
                      type="button"
                      className="flex w-full flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-left text-sm transition hover:bg-[var(--surface-panel)]/70"
                    >
                      <span>
                        <span
                          className={cn(
                            "font-mono text-[10px] uppercase",
                            row.tone === "danger" && "text-[var(--danger)]",
                            row.tone === "warn" && "text-[var(--warn)]",
                            row.tone === "muted" && "text-[var(--muted)]",
                          )}
                        >
                          {row.severity}
                        </span>{" "}
                        {row.title}
                      </span>
                      <span className="font-mono text-[10px] text-[var(--muted)]">
                        {row.meta}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>

            <Section
              id="table"
              title="Table"
              hint="House owners / call-list grid."
            >
              <div className="overflow-x-auto border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                      <th className="px-3 py-2 font-normal">Owner</th>
                      <th className="px-3 py-2 font-normal">Purok</th>
                      <th className="px-3 py-2 font-normal">Phone</th>
                      <th className="px-3 py-2 font-normal">Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">Antonio Ramos</td>
                      <td className="px-3 py-2">Purok 6</td>
                      <td className="px-3 py-2 font-mono text-xs">09181234511</td>
                      <td className="px-3 py-2">
                        <Badge variant="danger">evacuate</Badge>
                      </td>
                    </tr>
                    <tr className="border-b border-[var(--border)]">
                      <td className="px-3 py-2">Rosa Aquino</td>
                      <td className="px-3 py-2">Purok 4</td>
                      <td className="px-3 py-2 font-mono text-xs">09191234508</td>
                      <td className="px-3 py-2">
                        <Badge variant="warn">prepare</Badge>
                      </td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2">Ken Dan S. Tinio</td>
                      <td className="px-3 py-2">Purok 6</td>
                      <td className="px-3 py-2 font-mono text-xs">09606075119</td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">monitor</Badge>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            <Section
              id="chat"
              title="Chat"
              hint="Mangluluwas shell — matches /command (Lucide history/new/send)."
            >
              <div className="flex max-w-md flex-col border border-[var(--border)] bg-[var(--surface)]">
                <header className="space-y-2.5 border-b border-[var(--border)] bg-[var(--surface-panel)] px-3 py-3">
                  <div className="flex items-center gap-2">
                    <Image
                      src="/mangluluwas.jpg"
                      alt="Mangluluwas"
                      width={40}
                      height={40}
                      className="size-10 rounded-full object-cover ring-2 ring-[var(--accent)]/35"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                        Mangluluwas
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.16em] text-[var(--accent)] uppercase">
                        New chat
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="icon" className="size-8">
                      <History className="size-3.5" />
                    </Button>
                    <Button type="button" variant="outline" size="icon" className="size-8">
                      <Plus className="size-3.5" />
                    </Button>
                  </div>
                  <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
                    Model
                    <select className="min-w-0 flex-1 border border-[var(--border)] bg-[var(--input)] px-2 py-1 text-[11px] normal-case tracking-normal text-[var(--foreground)] outline-none focus:border-[var(--accent)]">
                      <option>Gemini 3.5 Flash-Lite</option>
                      <option>Gemini 3.5 Flash</option>
                    </select>
                  </label>
                </header>

                <div className="flex max-h-56 flex-col gap-3 overflow-y-auto px-3 py-3">
                  {chat.map((m, i) => (
                    <div
                      key={`${m.role}-${i}`}
                      className={cn(
                        "flex gap-2",
                        m.role === "user" ? "justify-end" : "justify-start",
                      )}
                    >
                      {m.role === "ai" ? (
                        <Image
                          src="/mangluluwas.jpg"
                          alt=""
                          width={28}
                          height={28}
                          className="mt-0.5 size-7 shrink-0 rounded-full object-cover"
                        />
                      ) : null}
                      <div
                        className={cn(
                          "max-w-[85%] px-3 py-2 text-sm leading-relaxed",
                          m.role === "user"
                            ? "bg-[var(--accent)] text-[var(--on-accent)]"
                            : "border border-[var(--border)] bg-[var(--surface-raised)]",
                        )}
                      >
                        {m.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2.5">
                  <div className="-mx-1 mb-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDraft(s)}
                        className="shrink-0 border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 font-mono text-[9px] tracking-wider whitespace-nowrap text-[var(--muted)] uppercase transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <form onSubmit={sendChat} className="flex items-end gap-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={1}
                      placeholder="Ask Mangluluwas…"
                      className="min-h-10 max-h-28 flex-1 resize-none border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                    />
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!draft.trim()}
                      aria-label="Send"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                  </form>
                </div>
              </div>
            </Section>

            <Section
              id="map"
              title="Map chips"
              hint="Floating weather pill over Leaflet."
            >
              <div className="inline-flex items-baseline gap-2 rounded-full border border-[var(--border)] bg-[var(--surface-raised)]/90 px-3 py-1.5 font-mono text-[11px] shadow-md backdrop-blur-md">
                <span className="font-[family-name:var(--font-display)] text-base font-semibold tabular-nums">
                  30°
                </span>
                <span className="text-[var(--muted)]">Mostly cloudy</span>
                <span className="text-[var(--border)]">·</span>
                <span className="text-[var(--muted)]">rain 0.1</span>
                <span className="text-[var(--muted)]">wind 3</span>
              </div>
            </Section>
          </main>
        </div>
      </div>

      <HomeFooter />
    </div>
  );
}
