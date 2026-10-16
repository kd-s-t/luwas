"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FadeIn } from "@/components/motion/primitives";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { scopeLabel } from "@/lib/reports/barangayScope";
import {
  ASSIST_STEPS,
  buildAssistancePlan,
  type AssistStepId,
  type CompletedDelivery,
  type OtherUpdate,
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
          ✓ Delivered
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
  return (
    <ol className="mt-5 grid gap-2 sm:grid-cols-4">
      {ASSIST_STEPS.map((step, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        return (
          <li key={step.id} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  done && "bg-[#16794c] text-white",
                  active && "bg-[#2f5f9e] text-white",
                  !done && !active && "bg-[var(--foreground)]/8 text-[var(--muted)]",
                )}
              >
                {done ? "✓" : i + 1}
              </span>
              <span
                className={cn(
                  "truncate text-[12px] font-medium",
                  active
                    ? "text-[#2f5f9e]"
                    : done
                      ? "text-[#16794c]"
                      : "text-[var(--muted)]",
                )}
              >
                {step.label}
              </span>
            </div>
            <div
              className={cn(
                "mt-2 h-1 rounded-full",
                done || active ? "bg-[#2f5f9e]" : "bg-[var(--border)]",
                done && "bg-[#16794c]",
              )}
            />
          </li>
        );
      })}
    </ol>
  );
}

export function FindAssistanceFlow() {
  const searchParams = useSearchParams();
  const reportParam = searchParams.get("report");
  const { profile } = useAuth();
  const { scopedReports, activeOfficers, reportScope } =
    useCommandWorkspace();

  const [step, setStep] = useState<AssistStepId>("explore");
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [approved, setApproved] = useState(false);

  const plan = useMemo(
    () =>
      buildAssistancePlan(
        scopedReports,
        activeOfficers.length,
        reportParam,
      ),
    [scopedReports, activeOfficers.length, reportParam],
  );

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

  const selected =
    plan.partners.find((p) => p.id === activePartnerId) || plan.partners[0]!;

  function onContinue() {
    if (step === "explore") {
      setStep("review");
      return;
    }
    if (step === "review") {
      setStep("approve");
      return;
    }
    if (step === "approve") {
      setApproved(true);
    }
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
        <Stepper current={step} />
      </FadeIn>

      <div className="mt-5 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <div className="min-w-0 space-y-4">
          <section className="rounded-2xl border border-[#fecaca] bg-[#fff7f7] p-4 shadow-sm sm:p-5">
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
            <h2 className="mt-2 text-base font-semibold tracking-tight">
              Selected need · {plan.place}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
              {plan.detail}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-[var(--muted)]">
              <span>{plan.householdsLabel}</span>
              <span>
                Needed ·{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {plan.neededLabel}
                </span>
              </span>
            </div>
          </section>

          {(step === "explore" || step === "identify") && (
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
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
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
                <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                  Partner and external options
                  <span className="ml-2 text-[12px] font-normal text-[var(--muted)]">
                    ({plan.partners.length} sources)
                  </span>
                </h2>
                <div className="mt-3 space-y-3">
                  {plan.partners.map((option) => {
                    const active = option.id === activePartnerId;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedPartner(option.id)}
                        className={cn(
                          "w-full rounded-2xl border px-4 py-3.5 text-left transition",
                          active
                            ? "border-[#3b6fb6] bg-[#f8fbff] shadow-sm"
                            : "border-[var(--border)] bg-white hover:border-[var(--foreground)]/20",
                        )}
                      >
                        <div className="flex items-start gap-3">
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
                              <p className="font-medium text-[var(--foreground)]">
                                {option.partner}
                              </p>
                              {option.recommended ? (
                                <span className="rounded-full bg-[#3b6fb6]/10 px-2 py-0.5 text-[10px] font-semibold text-[#2f5f9e] ring-1 ring-[#3b6fb6]/20">
                                  Recommended
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-sm text-[var(--muted)]">
                              {option.offerLine} · {option.statusLine} ·{" "}
                              {option.etaLine}
                            </p>
                            {active ? (
                              <div className="mt-2 rounded-xl border border-[#93c5fd]/50 bg-[#eff6ff] px-3 py-2 text-[12px] text-[#2f5f9e]">
                                <p className="font-medium">
                                  This option helps address
                                </p>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                  {option.helps.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </>
          )}

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
                <p className="mt-3 rounded-xl border border-[#86efac]/60 bg-[#ecfdf3] px-3 py-3 text-sm text-[#16794c]">
                  Commitment recorded as approved draft. Tracking stays on the
                  incident until field evidence is attached.
                </p>
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

          <details
            open
            className="group rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5"
          >
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

          <details
            open
            className="group rounded-2xl border border-[var(--border)] bg-white px-4 py-3 shadow-sm sm:px-5"
          >
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
                  Approvals, unassigned incidents and other important updates.
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
          </section>

          <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm sm:p-5">
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Next step
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              {step === "explore" && plan.nextStepCopy}
              {step === "review" &&
                `Confirm ${plan.planCode} with ${selected.partner}, then continue to human approval.`}
              {step === "approve" &&
                (approved
                  ? "Approval saved. Return to resources or open the incident for tracking."
                  : `Approve ${plan.planCode} to commit ${selected.partner} for ${plan.incidentCode}.`)}
            </p>
            <button
              type="button"
              onClick={onContinue}
              disabled={step === "approve" && approved}
              className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[#2f5f9e] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#244a7c] disabled:cursor-default disabled:opacity-60"
            >
              {step === "explore"
                ? `Continue to review ${plan.planCode}`
                : step === "review"
                  ? "Continue to approval"
                  : approved
                    ? "Approved"
                    : `Approve ${plan.planCode}`}
            </button>
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
            {step !== "explore" ? (
              <button
                type="button"
                onClick={() =>
                  setStep(step === "approve" ? "review" : "explore")
                }
                className="mt-2 text-sm font-medium text-[#2f5f9e] hover:underline"
              >
                ← Back
              </button>
            ) : null}
          </section>
        </aside>
      </div>
    </div>
  );
}
