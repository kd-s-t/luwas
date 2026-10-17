"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AllocationPlanStepper } from "@/components/AllocationPlanStepper";
import { FadeIn } from "@/components/motion/primitives";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isAccountActive, isOfficer } from "@/lib/auth/types";
import {
  ensureApasPartners,
  ensureNangkaPartners,
  subscribeResourcePartners,
} from "@/lib/partners/api";
import { APAS_BARANGAY_DOC_ID } from "@/lib/partners/apasPartners";
import { NANGKA_BARANGAY_ID } from "@/lib/partners/nangkaPartners";
import type { ResourcePartner } from "@/lib/partners/types";
import { scopeLabel } from "@/lib/reports/barangayScope";
import {
  commitmentForReport,
  saveAssistanceCommitment,
} from "@/lib/workspace/assistanceCommitments";
import {
  ASSIST_STEPS,
  buildAssistancePlan,
  type AssistStepId,
  type CompletedDelivery,
  type OtherUpdate,
  type PartnerOption,
} from "@/lib/workspace/assistancePlan";
import { cn } from "@/lib/utils";

function tagTone(tone: OtherUpdate["tags"][number]["tone"]) {
  if (tone === "critical") {
    return "bg-[#c72929]/10 text-[#c72929] ring-[#c72929]/20";
  }
  if (tone === "warn") {
    return "bg-[#f59e0b]/12 text-[#b45309] ring-[#f59e0b]/25";
  }
  if (tone === "info") {
    return "bg-[#3b6fb6]/10 text-[#2f5f9e] ring-[#3b6fb6]/20";
  }
  return "bg-[var(--foreground)]/5 text-[var(--muted)] ring-[var(--border)]";
}

function CompletedCard({ item }: { item: CompletedDelivery }) {
  return (
    <article className="rounded-2xl border border-[#86efac]/50 bg-[#f0fdf4]/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[var(--foreground)]">
            {item.place} · {item.incidentCode}
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            Relief assistance · {item.teamLabel}
          </p>
        </div>
        <span className="rounded-full bg-[#ecfdf3] px-2.5 py-0.5 text-[11px] font-semibold text-[#16794c] ring-1 ring-[#86efac]/60">
          Delivered
        </span>
      </div>
      <p className="mt-3 text-sm font-medium text-[var(--foreground)]">
        {item.supplyLine}
      </p>
      <p className="mt-1 text-[12px] text-[var(--muted)]">
        Delivered at {item.deliveredAt}
      </p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          {item.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt=""
              className="size-12 rounded-lg object-cover ring-1 ring-[var(--border)]"
            />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-lg bg-[var(--foreground)]/5 text-[10px] text-[var(--muted)] ring-1 ring-[var(--border)]">
              Evidence
            </div>
          )}
          {item.evidenceExtra > 0 ? (
            <span className="flex size-12 items-center justify-center rounded-lg bg-[var(--foreground)]/5 text-xs font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              +{item.evidenceExtra}
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl border border-[#93c5fd] bg-white px-3 py-2 text-sm font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
          >
            View delivery evidence
          </Link>
          <Link
            href={item.detailsHref}
            className="inline-flex rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
          >
            View details
          </Link>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--muted)]">
        {item.teamLabel} · {item.vehicleLabel} · {item.officerLabel}
      </p>
    </article>
  );
}

function OtherUpdateCard({ item }: { item: OtherUpdate }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {item.tags.map((tag) => (
              <span
                key={tag.label}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide ring-1",
                  tagTone(tag.tone),
                )}
              >
                {tag.label}
              </span>
            ))}
          </div>
          <h3 className="mt-2 text-base font-semibold tracking-tight">
            {item.place} · {item.incidentCode}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            {item.detail}
          </p>
        </div>
        <div className="shrink-0 text-left sm:text-right">
          <p className="text-[12px] text-[var(--muted)]">{item.timeLabel}</p>
          <p className="mt-0.5 text-[12px] font-medium text-[var(--foreground)]">
            {item.metaLabel}
          </p>
          <Link
            href={item.ctaHref}
            className="mt-3 inline-flex rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
          >
            {item.ctaLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}

function formatPlaceLine(date: Date, place: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Manila",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  return `${place} · ${day} ${month} ${year} · Philippine Standard Time (PHT)`;
}

function stepIndex(id: AssistStepId): number {
  return ASSIST_STEPS.findIndex((s) => s.id === id);
}

function Stepper({ current }: { current: AssistStepId }) {
  const currentIdx = stepIndex(current);
  const progressTo = Math.max(0, currentIdx);
  const last = ASSIST_STEPS.length - 1;

  return (
    <div className="mt-5 overflow-x-auto pb-1">
      <ol className="mx-auto grid min-w-[28rem] grid-cols-4 gap-0 px-1">
        <li className="relative col-span-4 h-8" aria-hidden>
          <span className="absolute top-1/2 right-[12.5%] left-[12.5%] h-0.5 -translate-y-1/2 bg-[var(--border)]" />
          <span
            className="absolute top-1/2 left-[12.5%] h-0.5 -translate-y-1/2 bg-[#86efac]"
            style={{
              width:
                last <= 0 ? "0%" : `${(progressTo / last) * 75}%`,
            }}
          />
          <ol className="relative z-[1] grid h-full grid-cols-4">
            {ASSIST_STEPS.map((step, i) => {
              const done = i < currentIdx;
              const active = i === currentIdx;
              return (
                <li
                  key={`${step.id}-dot`}
                  className="flex items-center justify-center"
                >
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold",
                      done && "bg-[#16794c] text-white",
                      active &&
                        "bg-[#2f5f9e] text-white ring-4 ring-[#2f5f9e]/15",
                      !done &&
                        !active &&
                        "bg-[var(--foreground)]/6 text-[var(--muted)]",
                    )}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                </li>
              );
            })}
          </ol>
        </li>
        {ASSIST_STEPS.map((step, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <li
              key={step.id}
              className="mt-2.5 min-w-0 px-1 text-center"
            >
              <p
                className={cn(
                  "text-[12px] font-semibold tracking-tight sm:text-[13px]",
                  active
                    ? "text-[#2f5f9e]"
                    : done
                      ? "text-[#16794c]"
                      : "text-[var(--muted)]",
                )}
              >
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                {done ? "Reviewed" : active ? "Current" : "Next"}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PartnerCard({
  option,
  active,
  onSelect,
}: {
  option: PartnerOption;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border px-4 py-4 text-left transition sm:px-5",
        active
          ? "border-[#3b6fb6] bg-[#f8fbff] shadow-sm"
          : "border-[var(--border)] bg-white hover:border-[var(--foreground)]/20",
      )}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <span
          className={cn(
            "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
            active
              ? "border-[#2f5f9e] bg-[#2f5f9e]"
              : "border-[var(--border)] bg-white",
          )}
          aria-hidden
        >
          {active ? (
            <span className="size-1.5 rounded-full bg-white" />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-semibold text-[var(--foreground)]">
              {option.partner}
            </p>
            {option.recommended ? (
              <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[10px] font-semibold text-[#16794c] ring-1 ring-[#86efac]/60">
                Recommended
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {option.categoryLine}
          </p>
          <p className="mt-1.5 text-sm text-[var(--foreground)]">
            {option.offerLine}
          </p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            {option.statusLine}
          </p>
          <p className="mt-0.5 text-[12px] text-[var(--muted)]">
            {option.etaLine}
          </p>
        </div>
        <div
          className={cn(
            "hidden w-[11.5rem] shrink-0 rounded-xl px-3 py-2.5 text-[11px] leading-snug sm:block",
            active
              ? "border border-[#93c5fd]/50 bg-[#eff6ff] text-[#2f5f9e]"
              : "border border-[var(--border)] bg-[#f8fafc] text-[var(--muted)]",
          )}
        >
          <p className="font-semibold">
            {active ? "This option helps address" : "Note"}
          </p>
          <ul className="mt-1 space-y-0.5">
            {option.helps.slice(0, 3).map((line) => (
              <li key={line}>· {line}</li>
            ))}
          </ul>
        </div>
      </div>
      {active ? (
        <div className="mt-3 rounded-xl border border-[#93c5fd]/50 bg-[#eff6ff] px-3 py-2 text-[12px] text-[#2f5f9e] sm:hidden">
          <p className="font-medium">This option helps address</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {option.helps.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </button>
  );
}

export function FindAssistanceFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reportParam = searchParams.get("report");
  const rsParam = (searchParams.get("rs") ?? "").trim().toUpperCase();
  const fromAllocationCompare = Boolean(
    searchParams.get("option") || rsParam,
  );

  useEffect(() => {
    if (!rsParam) return;
    const track = `/admin/resources/track/${encodeURIComponent(rsParam)}`;
    router.replace(
      reportParam
        ? `${track}?report=${encodeURIComponent(reportParam)}`
        : track,
    );
  }, [rsParam, reportParam, router]);
  const { profile } = useAuth();
  const { scopedReports, activeOfficers, reportScope } =
    useCommandWorkspace();

  const [step, setStep] = useState<AssistStepId>("explore");
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);
  const [directory, setDirectory] = useState<ResourcePartner[]>([]);
  const seeded = useRef(false);
  const hydrated = useRef(false);

  const barangayId = useMemo(() => {
    if (!isOfficer(profile)) return NANGKA_BARANGAY_ID;
    const area = (profile.areaId ?? profile.activeBarangayId)?.trim();
    if (area?.includes("apas")) return APAS_BARANGAY_DOC_ID;
    return NANGKA_BARANGAY_ID;
  }, [profile]);

  useEffect(() => {
    if (!isOfficer(profile) || !isAccountActive(profile)) {
      setDirectory([]);
      return;
    }
    return subscribeResourcePartners(barangayId, setDirectory);
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

  const plan = useMemo(
    () =>
      buildAssistancePlan(
        scopedReports,
        activeOfficers.length,
        reportParam,
        directory,
      ),
    [scopedReports, activeOfficers.length, reportParam, directory],
  );

  useEffect(() => {
    hydrated.current = false;
    setApproved(false);
    setSelectedPartner(null);
    setNote("");
    setStep("explore");
  }, [reportParam]);

  useEffect(() => {
    if (!plan || hydrated.current) return;
    hydrated.current = true;
    const existing = commitmentForReport(plan.reportId);
    if (existing) {
      setApproved(true);
      setSelectedPartner(existing.partnerId);
      setNote(existing.note);
      setStep("approve");
    }
  }, [plan]);

  const placeHint = useMemo(() => {
    if (plan?.place) return plan.place;
    if (isOfficer(profile) && profile.barangay?.trim()) {
      return profile.barangay.trim();
    }
    return scopeLabel(reportScope);
  }, [plan?.place, profile, reportScope]);

  const placeLine = useMemo(
    () => formatPlaceLine(new Date(), placeHint),
    [placeHint],
  );

  const activePartnerId =
    selectedPartner || plan?.partners.find((p) => p.recommended)?.id || null;

  if (!plan) {
    return (
      <div className="flex flex-1 flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link
          href="/admin/resources"
          className="text-sm font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to resources
        </Link>
        <div className="mt-10 flex flex-1 flex-col items-center justify-center text-center">
          <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
            No open shortage to assist
          </h1>
          <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
            When a resource gap is on the board, Find assistance opens here.
          </p>
        </div>
      </div>
    );
  }

  const activePlan = plan;
  const selected =
    activePlan.partners.find((p) => p.id === activePartnerId) ||
    activePlan.partners[0]!;
  const incidentHref = `/admin/incidents/${encodeURIComponent(activePlan.reportId)}`;

  function onContinue() {
    if (step === "identify") {
      setStep("explore");
      return;
    }
    if (step === "explore") {
      setStep("review");
      return;
    }
    if (step === "review") {
      setStep("approve");
      return;
    }
    if (step === "approve" && !approved) {
      saveAssistanceCommitment({
        planCode: activePlan.planCode,
        reportId: activePlan.reportId,
        incidentCode: activePlan.incidentCode,
        place: activePlan.place,
        partnerId: selected.id,
        partnerName: selected.partner,
        offerLine: selected.offerLine,
        note: note.trim(),
      });
      setApproved(true);
    }
  }

  function stepBack() {
    if (step === "explore") setStep("identify");
    else if (step === "review") setStep("explore");
    else if (step === "approve" && !approved) setStep("review");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <FadeIn y={8} className="shrink-0">
        <Link
          href="/admin/resources"
          className="text-sm font-medium text-[#2f5f9e] hover:underline"
        >
          ← Back to resources
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide text-[var(--foreground)] sm:text-[2rem]">
          Find assistance
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-[var(--muted)]">
          Explore local resources and partner offers to address the need.{" "}
          {placeLine}
        </p>
        {fromAllocationCompare ? (
          <AllocationPlanStepper
            current={approved ? 3 : 2}
            className="mt-4"
          />
        ) : (
          <Stepper current={step} />
        )}
      </FadeIn>

      <div className="mt-5 grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-4 shadow-sm sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="rounded-full bg-[#f59e0b]/12 px-2 py-0.5 text-[10px] font-semibold text-[#b45309] ring-1 ring-[#f59e0b]/25">
                  {plan.kindLabel}
                </span>
                <span className="font-mono text-[11px] tracking-wide text-[var(--muted)]">
                  {plan.incidentCode}
                </span>
                <span className="text-[11px] text-[var(--muted)]">
                  From incident
                </span>
              </div>
              <Link
                href={incidentHref}
                className="text-sm font-medium text-[#2f5f9e] hover:underline"
              >
                View incident →
              </Link>
            </div>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight">
                  Selected need · {plan.place}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
                  {plan.detail}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-x-6 gap-y-2 text-[12px] sm:flex-col sm:items-end sm:text-right">
                <div>
                  <p className="text-[var(--muted)]">Households</p>
                  <p className="mt-0.5 font-semibold text-[var(--foreground)]">
                    {plan.householdsLabel.match(/\d+/)?.[0] ??
                      plan.householdsLabel}
                  </p>
                </div>
                <div>
                  <p className="text-[var(--muted)]">Needed</p>
                  <p className="mt-0.5 font-semibold text-[var(--foreground)]">
                    {plan.neededLabel}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {step === "identify" ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Identify shortage
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Confirm this is the gap to fill before exploring local stock and
                partner offers. Local inventory is scarce for food, water, and
                medical kits.
              </p>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3">
                  <dt className="text-[11px] text-[var(--muted)]">Incident</dt>
                  <dd className="mt-0.5 font-mono text-sm font-semibold">
                    {plan.incidentCode}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3">
                  <dt className="text-[11px] text-[var(--muted)]">Place</dt>
                  <dd className="mt-0.5 text-sm font-semibold">{plan.place}</dd>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3">
                  <dt className="text-[11px] text-[var(--muted)]">Need</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    {plan.neededLabel}
                  </dd>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3.5 py-3">
                  <dt className="text-[11px] text-[var(--muted)]">Kind</dt>
                  <dd className="mt-0.5 text-sm font-semibold">
                    {plan.kindLabel}
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {plan.localStock.map((cell) => (
                  <div
                    key={cell.id}
                    className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3 py-3"
                  >
                    <p className="text-[11px] text-[var(--muted)]">{cell.label}</p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        cell.ok ? "text-[#16794c]" : "text-[#c2410c]",
                      )}
                    >
                      {cell.available} available
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {step === "explore" ? (
            <>
              <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                    Local municipal resources
                  </h2>
                  <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fdba74]/70">
                    Limited
                  </span>
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                  {plan.localStock.map((cell) => (
                    <div
                      key={cell.id}
                      className="rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3 py-3"
                    >
                      <p className="text-[11px] text-[var(--muted)]">
                        {cell.label}
                      </p>
                      <p
                        className={cn(
                          "mt-1 text-sm font-semibold",
                          cell.ok ? "text-[#16794c]" : "text-[#c2410c]",
                        )}
                      >
                        {cell.available} available
                      </p>
                      <p
                        className={cn(
                          "mt-0.5 text-[11px]",
                          cell.ok ? "text-[#16794c]" : "text-[#c2410c]",
                        )}
                      >
                        {cell.hint}
                      </p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-snug text-[var(--muted)]">
                  Last check {plan.lastCheckLabel} · Recheck stock and
                  reservations before allocation. Assigned stock is excluded.
                </p>
              </section>

              <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                    Partner and external options
                  </h2>
                  <span className="text-[12px] text-[var(--muted)]">
                    {plan.partners.length} sources
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {plan.partners.map((option) => (
                    <PartnerCard
                      key={option.id}
                      option={option}
                      active={option.id === activePartnerId}
                      onSelect={() => setSelectedPartner(option.id)}
                    />
                  ))}
                </div>
              </section>
            </>
          ) : null}

          {step === "review" ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Review resource plan · {plan.planCode}
              </h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
                  <dt className="text-[var(--muted)]">Incident</dt>
                  <dd className="font-medium">{plan.incidentCode}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
                  <dt className="text-[var(--muted)]">Partner</dt>
                  <dd className="font-medium">{selected.partner}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
                  <dt className="text-[var(--muted)]">Offer</dt>
                  <dd className="text-right font-medium">{selected.offerLine}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-[var(--border)] py-2">
                  <dt className="text-[var(--muted)]">ETA</dt>
                  <dd className="text-right">{selected.etaLine}</dd>
                </div>
                <div className="flex justify-between gap-4 py-2">
                  <dt className="text-[var(--muted)]">Status</dt>
                  <dd className="text-right">{selected.statusLine}</dd>
                </div>
              </dl>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Recheck availability with the partner before approval. Local
                stock is not reserved by this draft.
              </p>
            </section>
          ) : null}

          {step === "approve" ? (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
              <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                Approve and track · {plan.planCode}
              </h2>
              {approved ? (
                <div className="mt-3 space-y-3">
                  <p className="rounded-xl border border-[#86efac]/60 bg-[#ecfdf3] px-3 py-3 text-sm text-[#16794c]">
                    {plan.planCode} approved. {selected.partner} is committed for{" "}
                    {plan.incidentCode}. The need leaves the open Resources
                    board and appears in activity as assistance approved.
                  </p>
                  <Link
                    href="/admin/resources"
                    className="inline-flex rounded-xl bg-[#2f5f9e] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#244a7c]"
                  >
                    Back to Resources desk →
                  </Link>
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Human approval commits {selected.partner} against{" "}
                  {plan.incidentCode}. AI text above is advisory only.
                </p>
              )}
              {note.trim() ? (
                <p className="mt-3 text-sm text-[var(--muted)]">
                  Coordinator note · {note.trim()}
                </p>
              ) : null}
            </section>
          ) : null}

          {step === "approve" || step === "review" ? (
            <>
              <details className="group rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                        Completed
                      </h2>
                      <span className="rounded-full bg-[#ecfdf3] px-2 py-0.5 text-[11px] font-medium text-[#16794c] ring-1 ring-[#86efac]/60">
                        {plan.completed.length}{" "}
                        {plan.completed.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      Delivered assistance with recorded evidence.
                    </p>
                  </div>
                  <span className="text-[var(--muted)] group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  {plan.completed.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      No completed deliveries in scope yet.
                    </p>
                  ) : (
                    plan.completed.map((item) => (
                      <CompletedCard key={item.id} item={item} />
                    ))
                  )}
                </div>
              </details>

              <details className="group rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                        Other updates
                      </h2>
                      <span className="rounded-full bg-[var(--foreground)]/6 px-2 py-0.5 text-[11px] font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
                        {plan.otherUpdates.length}{" "}
                        {plan.otherUpdates.length === 1 ? "item" : "items"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      Approvals, unassigned incidents and other important
                      updates.
                    </p>
                  </div>
                  <span className="text-[var(--muted)] group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <div className="mt-3 space-y-3">
                  {plan.otherUpdates.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">
                      No other updates beside this need.
                    </p>
                  ) : (
                    plan.otherUpdates.map((item) => (
                      <OtherUpdateCard key={item.id} item={item} />
                    ))
                  )}
                </div>
              </details>
            </>
          ) : null}

          <p className="pb-2 text-center text-[11px] text-[var(--muted)]">
            Conceptual exercise data · Not a live emergency feed.
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
          <section className="rounded-2xl border border-[#93c5fd]/60 bg-[#eff6ff] p-4 shadow-sm sm:p-5">
            <p className="text-[11px] font-medium tracking-wide text-[#2f5f9e] uppercase">
              AI summary and recommendation
            </p>
            <h2 className="mt-2 text-base font-semibold text-[var(--foreground)]">
              {plan.aiHeadline}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {plan.aiBody}
            </p>
            {plan.considerations.length > 0 ? (
              <div className="mt-3">
                <p className="text-[12px] font-medium text-[#2f5f9e]">
                  Additional considerations
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-4 text-[12px] text-[var(--muted)]">
                  {plan.considerations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Link
              href="/admin/partners"
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl border border-[#93c5fd] bg-white px-4 py-2.5 text-sm font-medium text-[#2f5f9e] transition hover:border-[#3b6fb6]"
            >
              Request backup source
            </Link>
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Next step
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {step === "identify" &&
                "Confirm the shortage details, then explore local stock and partner options."}
              {step === "explore" && plan.nextStepCopy}
              {step === "review" &&
                `Confirm ${plan.planCode} with ${selected.partner}, then continue to human approval.`}
              {step === "approve" &&
                (approved
                  ? "Approval saved. Return to Resources to see the board update."
                  : `Approve ${plan.planCode} to commit ${selected.partner} for ${plan.incidentCode}.`)}
            </p>
            {approved ? (
              <Link
                href="/admin/resources"
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#2f5f9e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#244a7c]"
              >
                Return to Resources
              </Link>
            ) : (
              <button
                type="button"
                onClick={onContinue}
                className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#2f5f9e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#244a7c]"
              >
                {step === "identify"
                  ? "Continue to explore options"
                  : step === "explore"
                    ? "Continue to review plan"
                    : step === "review"
                      ? "Continue to approval"
                      : `Approve ${plan.planCode}`}
              </button>
            )}
            {step === "explore" && !approved ? (
              <Link
                href="/admin/resources"
                className="mt-2 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium text-[var(--foreground)] transition hover:border-[var(--foreground)]/25"
              >
                Other requests & urgent transport needs
              </Link>
            ) : null}
            {step !== "explore" && !approved ? (
              <button
                type="button"
                onClick={stepBack}
                className="mt-2 text-sm font-medium text-[#2f5f9e] hover:underline"
              >
                ← Back
              </button>
            ) : null}
            {!approved ? (
              <label className="mt-3 block">
                <span className="sr-only">Coordinator note</span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Optional coordinator note"
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[#f8fafc] px-3 py-2 text-sm outline-none placeholder:text-[var(--muted)] focus:border-[#3b6fb6]/50"
                />
              </label>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
