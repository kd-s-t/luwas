"use client";

import Image from "next/image";
import { Mail, MapPin, Phone, Search, User } from "lucide-react";
import { motion } from "framer-motion";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { easeOut, FadeIn, useMotionSafe } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  addResourcePartner,
  ensureApasPartners,
  ensureNangkaPartners,
  subscribeResourcePartners,
} from "@/lib/partners/api";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_ORG_NAME,
} from "@/lib/partners/apasPartners";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/partners/nangkaPartners";
import { CEBU_AREA } from "@/lib/geo/cebu";
import { distKm } from "@/lib/geo/bearing";
import {
  partnerLogoUrl,
  partnerSupplyLabel,
  partnerTypeLabel,
  type PartnerSupply,
  type PartnerType,
  type ResourcePartner,
} from "@/lib/partners/types";
import { formatDistanceKm } from "@/lib/reports/barangayScope";
import { cn } from "@/lib/utils";

const APAS_HALL = { lat: 10.337229, lng: 123.90484 };

function hallCenter(barangayId: string): { lat: number; lng: number } {
  if (barangayId.includes("apas")) return APAS_HALL;
  return CEBU_AREA.center;
}

function partnerDistanceKm(
  hall: { lat: number; lng: number },
  p: ResourcePartner,
): number | null {
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return distKm(hall, { lat, lng });
}

function directionsUrl(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}&destination=${to.lat},${to.lng}&travelmode=driving`;
}

const SUPPLY_OPTIONS: PartnerSupply[] = [
  "medical",
  "food",
  "water",
  "transport",
  "shelter",
  "other",
];

const TYPE_OPTIONS: PartnerType[] = [
  "ngo",
  "dswd",
  "lgu",
  "private",
  "other",
];

function resolveBarangay(profile: ReturnType<typeof useAuth>["profile"]): {
  barangayId: string;
  orgName: string;
} {
  if (!isOfficer(profile)) {
    return { barangayId: NANGKA_BARANGAY_ID, orgName: NANGKA_ORG_NAME };
  }
  const areaId = (profile.areaId ?? profile.activeBarangayId)?.trim();
  if (areaId?.includes("apas")) {
    return {
      barangayId: APAS_BARANGAY_DOC_ID,
      orgName: profile.orgName || APAS_ORG_NAME,
    };
  }
  return {
    barangayId: NANGKA_BARANGAY_ID,
    orgName: profile.orgName?.trim() || NANGKA_ORG_NAME,
  };
}

export function PartnersPanel() {
  const { profile } = useAuth();
  const { barangayId, orgName } = useMemo(
    () => resolveBarangay(profile),
    [profile],
  );
  const hall = useMemo(() => hallCenter(barangayId), [barangayId]);
  const motionOk = useMotionSafe();

  const [rows, setRows] = useState<ResourcePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inspect, setInspect] = useState<ResourcePartner | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      setCopiedKey(key);
      copiedTimer.current = setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setCopiedKey(null);
    }
  }

  const [name, setName] = useState("");
  const [type, setType] = useState<PartnerType>("ngo");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [coverage, setCoverage] = useState("");
  const [notes, setNotes] = useState("");
  const [supplies, setSupplies] = useState<PartnerSupply[]>(["medical"]);

  const seeded = useRef(false);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = partnerDistanceKm(hall, a);
      const db = partnerDistanceKm(hall, b);
      if (da == null && db == null) return a.name.localeCompare(b.name);
      if (da == null) return 1;
      if (db == null) return -1;
      return da - db;
    });
  }, [rows, hall]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeResourcePartners(
      barangayId,
      (next) => {
        setRows(next);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
    );
  }, [profile, barangayId]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    if (seeded.current) return;
    seeded.current = true;
    const run =
      barangayId === APAS_BARANGAY_DOC_ID
        ? ensureApasPartners()
        : barangayId === NANGKA_BARANGAY_ID
          ? ensureNangkaPartners()
          : Promise.resolve();
    void run.catch(() => {
      seeded.current = false;
    });
  }, [profile, barangayId]);

  function toggleSupply(s: PartnerSupply) {
    setSupplies((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      if (supplies.length === 0) {
        throw new Error("Pick at least one supply type.");
      }
      await addResourcePartner(barangayId, orgName, {
        name,
        type,
        contactName,
        phone,
        email,
        supplies,
        coverage: coverage || orgName,
        notes: notes.trim() || undefined,
      });
      setMsg(`${name.trim()} added to the partner directory.`);
      setName("");
      setContactName("");
      setPhone("");
      setEmail("");
      setCoverage("");
      setNotes("");
      setSupplies(["medical"]);
      setType("ngo");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add partner.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <FadeIn y={8}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
              Partners
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">
              After a meeting and agreement, record the contact person, phone,
              and email. Directory only. No partner login.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c]"
          >
            {open ? "Close form" : "Add partner"}
          </button>
        </div>
      </FadeIn>

      {msg ? (
        <p className="rounded-xl border border-[#86efac]/60 bg-[#ecfdf3] px-3 py-2 text-sm text-[#16794c]">
          {msg}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-3 py-2 text-sm text-[#c72929]">
          {error}
        </p>
      ) : null}

      {open ? (
        <FadeIn y={6}>
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5"
          >
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              New partner
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Organization name
                </span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Red Cross Cebu"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Type
                </span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PartnerType)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                >
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {partnerTypeLabel(t)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Coverage
                </span>
                <input
                  value={coverage}
                  onChange={(e) => setCoverage(e.target.value)}
                  placeholder="Consolacion · Metro Cebu"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Contact person
                </span>
                <input
                  required
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="C. Lim"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Phone
                </span>
                <input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0917…"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Email
                </span>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="c.lim@example.org"
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Supplies
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUPPLY_OPTIONS.map((s) => {
                    const on = supplies.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSupply(s)}
                        className={cn(
                          "rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 transition",
                          on
                            ? "bg-[#2f5f9e] text-white ring-[#2f5f9e]"
                            : "bg-white text-[var(--muted)] ring-[var(--border)] hover:ring-[var(--foreground)]/25",
                        )}
                      >
                        {partnerSupplyLabel(s)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block sm:col-span-2">
                <span className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Confirm before allocation."
                  className="mt-1 w-full resize-none rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3b6fb6]/50"
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c] disabled:opacity-60"
              >
                {busy ? "Saving…" : "Save partner"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)]"
              >
                Cancel
              </button>
            </div>
          </form>
        </FadeIn>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Directory
          </h2>
          <span className="text-[12px] text-[var(--muted)]">
            {loading
              ? "Loading…"
              : `${rows.length} active · nearest first`}
          </span>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5">
            No partners yet. Add Red Cross, DSWD, or an NGO to use them in Find
            assistance.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {sortedRows.map((p, i) => {
              const logo = partnerLogoUrl(p);
              const km = partnerDistanceKm(hall, p);
              return (
                <li key={p.id} className="px-4 py-4 sm:px-5">
                  <FadeIn y={8} delay={Math.min(i * 0.03, 0.24)}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#f4f6f8]">
                        {logo ? (
                          <Image
                            src={logo}
                            alt=""
                            width={44}
                            height={44}
                            className="size-11 object-contain"
                          />
                        ) : (
                          <span className="text-[11px] font-semibold tracking-wide text-[var(--muted)]">
                            {partnerTypeLabel(p.type).slice(0, 3).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <p className="font-semibold text-[var(--foreground)]">
                            {p.name}
                          </p>
                          <span className="text-[11px] font-medium text-[var(--muted)]">
                            {partnerTypeLabel(p.type)}
                          </span>
                          {km != null &&
                          Number.isFinite(Number(p.lat)) &&
                          Number.isFinite(Number(p.lng)) ? (
                            <a
                              href={directionsUrl(hall, {
                                lat: Number(p.lat),
                                lng: Number(p.lng),
                              })}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#2f5f9e] underline-offset-2 transition hover:underline"
                            >
                              <MapPin
                                className="size-3 shrink-0"
                                aria-hidden
                              />
                              {formatDistanceKm(km)} from hall
                            </a>
                          ) : null}
                        </div>
                        <p className="text-[13px] text-[var(--foreground)]">
                          {p.supplies.map(partnerSupplyLabel).join(" · ") ||
                            "Supplies TBD"}
                        </p>
                        <p className="text-[12px] text-[var(--muted)]">
                          {[p.coverage || null, p.notes || null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-2 sm:max-w-[16rem]">
                      <div className="min-w-0 flex-1 space-y-1 text-[12px] text-[var(--muted)] sm:text-right">
                        {p.contactName ? (
                          <p className="flex items-center gap-1.5 text-[var(--foreground)] sm:flex-row-reverse">
                            <User
                              className="size-3.5 shrink-0 text-[#2f5f9e]"
                              aria-hidden
                            />
                            <span className="truncate">{p.contactName}</span>
                          </p>
                        ) : null}
                        {p.phone ? (
                          <a
                            href={`tel:${p.phone.replace(/\s+/g, "")}`}
                            className="flex items-center gap-1.5 hover:text-[var(--foreground)] sm:flex-row-reverse"
                          >
                            <Phone
                              className="size-3.5 shrink-0 text-[#2f5f9e]"
                              aria-hidden
                            />
                            <span className="truncate">{p.phone}</span>
                          </a>
                        ) : null}
                        {p.email ? (
                          <a
                            href={`mailto:${p.email}`}
                            className="flex items-center gap-1.5 hover:text-[var(--foreground)] sm:flex-row-reverse"
                          >
                            <Mail
                              className="size-3.5 shrink-0 text-[#2f5f9e]"
                              aria-hidden
                            />
                            <span className="truncate">{p.email}</span>
                          </a>
                        ) : null}
                      </div>
                      <motion.button
                        type="button"
                        onClick={() => setInspect(p)}
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[#2f5f9e] hover:bg-[#f4f6f8]"
                        aria-label={`View contact for ${p.name}`}
                        whileHover={motionOk ? { scale: 1.06 } : undefined}
                        whileTap={motionOk ? { scale: 0.94 } : undefined}
                        transition={{ duration: 0.15, ease: easeOut }}
                      >
                        <Search className="size-3.5" aria-hidden />
                      </motion.button>
                    </div>
                  </div>
                  </FadeIn>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Dialog
        open={inspect != null}
        onOpenChange={(next) => {
          if (!next) {
            setInspect(null);
            setCopiedKey(null);
          }
        }}
      >
        <DialogContent className="max-w-md overflow-hidden p-0">
          <motion.div
            key={inspect?.id ?? "closed"}
            initial={motionOk ? { opacity: 0, y: 12, scale: 0.97 } : false}
            animate={motionOk ? { opacity: 1, y: 0, scale: 1 } : undefined}
            transition={{ duration: 0.3, ease: easeOut }}
          >
            <div className="border-b border-[var(--border)] px-6 pt-7 pr-12 pb-5">
              {inspect && partnerLogoUrl(inspect) ? (
                <FadeIn y={6} className="mb-4">
                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-xl bg-[#f4f6f8] ring-1 ring-[var(--border)]">
                    <Image
                      src={partnerLogoUrl(inspect)!}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14 object-contain p-1"
                    />
                  </div>
                </FadeIn>
              ) : null}
              <DialogTitle className="text-[1.65rem] leading-tight sm:text-[1.85rem]">
                {inspect?.name ?? "Partner"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Partner contact details
              </DialogDescription>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {inspect?.contactName ? (
                <FadeIn y={6} delay={0.04} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                        Contact
                      </p>
                      <p className="mt-0.5 truncate text-lg font-semibold text-[var(--foreground)] sm:text-xl">
                        {inspect.contactName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void copyText("contact", inspect.contactName)
                      }
                      aria-label="Copy contact name"
                      className="h-10 w-[4.5rem] shrink-0 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] transition hover:border-[#2f5f9e]/40 hover:text-[#2f5f9e]"
                    >
                      {copiedKey === "contact" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </FadeIn>
              ) : null}
              {inspect?.phone ? (
                <FadeIn y={6} delay={0.07} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                        Phone
                      </p>
                      <a
                        href={`tel:${inspect.phone.replace(/\s+/g, "")}`}
                        className="mt-0.5 block truncate text-lg font-semibold text-[#2f5f9e] hover:underline sm:text-xl"
                      >
                        {inspect.phone}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText("phone", inspect.phone)}
                      aria-label="Copy phone"
                      className="h-10 w-[4.5rem] shrink-0 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] transition hover:border-[#2f5f9e]/40 hover:text-[#2f5f9e]"
                    >
                      {copiedKey === "phone" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </FadeIn>
              ) : null}
              {inspect?.email ? (
                <FadeIn y={6} delay={0.1} className="px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium tracking-wide text-[var(--muted)] uppercase">
                        Email
                      </p>
                      <a
                        href={`mailto:${inspect.email}`}
                        className="mt-0.5 block truncate text-base font-semibold text-[#2f5f9e] hover:underline sm:text-lg"
                        title={inspect.email}
                      >
                        {inspect.email}
                      </a>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText("email", inspect.email)}
                      aria-label="Copy email"
                      className="h-10 w-[4.5rem] shrink-0 rounded-xl border border-[var(--border)] bg-white text-sm font-semibold text-[var(--foreground)] transition hover:border-[#2f5f9e]/40 hover:text-[#2f5f9e]"
                    >
                      {copiedKey === "email" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </FadeIn>
              ) : null}
            </div>
          </motion.div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
