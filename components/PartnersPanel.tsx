"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { FadeIn } from "@/components/motion/primitives";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  addResourcePartner,
  ensureNangkaPartners,
  subscribeResourcePartners,
} from "@/lib/partners/api";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_ORG_NAME,
} from "@/lib/partners/nangkaPartners";
import {
  partnerSupplyLabel,
  partnerTypeLabel,
  type PartnerSupply,
  type PartnerType,
  type ResourcePartner,
} from "@/lib/partners/types";
import { cn } from "@/lib/utils";

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
      barangayId: areaId,
      orgName: profile.orgName || "Apas · Cebu City",
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

  const [rows, setRows] = useState<ResourcePartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<PartnerType>("ngo");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [coverage, setCoverage] = useState("");
  const [notes, setNotes] = useState("");
  const [supplies, setSupplies] = useState<PartnerSupply[]>(["medical"]);

  const seeded = useRef(false);

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
    if (barangayId !== NANGKA_BARANGAY_ID) return;
    if (seeded.current) return;
    seeded.current = true;
    void ensureNangkaPartners().catch(() => {
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
        supplies,
        coverage: coverage || orgName,
        notes: notes.trim() || undefined,
      });
      setMsg(`${name.trim()} added to the partner directory.`);
      setName("");
      setContactName("");
      setPhone("");
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
              External supply sources for Find assistance. Directory only. No
              partner login.
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
            {loading ? "Loading…" : `${rows.length} active`}
          </span>
        </div>
        {rows.length === 0 && !loading ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--muted)] sm:px-5">
            No partners yet. Add Red Cross, DSWD, or an NGO to use them in Find
            assistance.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((p) => (
              <li key={p.id} className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-[var(--foreground)]">
                        {p.name}
                      </p>
                      <span className="rounded-full bg-[#3b6fb6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2f5f9e] ring-1 ring-[#3b6fb6]/20">
                        {partnerTypeLabel(p.type)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {p.contactName}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      {p.coverage || "Coverage TBD"}
                    </p>
                    <p className="mt-2 text-[12px] text-[var(--foreground)]">
                      {p.supplies.map(partnerSupplyLabel).join(" · ") ||
                        "Supplies TBD"}
                    </p>
                    {p.notes ? (
                      <p className="mt-1 text-[12px] text-[var(--muted)]">
                        {p.notes}
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
