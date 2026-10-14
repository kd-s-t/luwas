"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { triggerAutoResponderCall } from "@/lib/alerts/autoResponderCall";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import {
  assignReportInvestigator,
  updateReportValidation,
} from "@/lib/reports/api";
import {
  hazardHintLabel,
  type HazardReport,
} from "@/lib/reports/types";
import { cn } from "@/lib/utils";
import {
  activityForReport,
  proposalsForReport,
  relatedReports,
  unknownsForReport,
} from "@/lib/workspace/incidentDerived";
import { matchInventoryForHazard } from "@/lib/workspace/sampleInventory";

type PlanState = {
  notes: string;
  recordedAt: string | null;
};

type IncidentDetailProps = {
  reportId: string;
};

export function IncidentDetail({ reportId }: IncidentDetailProps) {
  const { profile } = useAuth();
  const {
    scopedReports,
    activeOfficers,
    seedReady,
  } = useCommandWorkspace();
  const [busy, setBusy] = useState(false);
  const [activityOpen, setActivityOpen] = useState(true);
  const [plan, setPlan] = useState<PlanState>({ notes: "", recordedAt: null });
  const [planDraft, setPlanDraft] = useState("");

  const ready = seedReady;
  const scoped = scopedReports;
  const officers = activeOfficers;

  const selected = scoped.find((r) => r.id === reportId) ?? null;

  useEffect(() => {
    if (!selected) {
      setPlanDraft("");
      return;
    }
    setPlanDraft(plan.notes);
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset draft when incident changes

  const unknowns = selected ? unknownsForReport(selected) : [];
  const proposals = selected ? proposalsForReport(selected) : [];
  const related = selected ? relatedReports(selected, scoped) : [];
  const activity = selected ? activityForReport(selected) : [];
  const inventory = selected
    ? matchInventoryForHazard(selected.hazardHint)
    : [];

  async function assignInvestigator(
    investigatorUid: string | null,
    investigatorName: string | null,
  ) {
    if (!selected) return;
    setBusy(true);
    try {
      await assignReportInvestigator({
        reportId: selected.id,
        investigatorUid,
        investigatorName,
      });
    } finally {
      setBusy(false);
    }
  }

  async function override(verdict: "legit" | "rejected") {
    if (!selected) return;
    setBusy(true);
    try {
      await updateReportValidation(selected.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: selected.aiConfidence ?? 1,
        aiReason:
          `Officer override → ${verdict}. ${selected.aiReason ?? ""}`.trim(),
        aiSource: selected.aiSource,
        aiModel: selected.aiModel,
        validatedAt: new Date().toISOString(),
        trustInput: {
          registered: Boolean(selected.citizenUid),
          idVerified: selected.reporterIdVerified,
          email: selected.reporterEmail,
          phone: selected.reporterPhone,
          emailVerified: selected.reporterEmailVerified,
          mediaSource: selected.mediaSource,
          lat: selected.lat,
          lng: selected.lng,
          locationAccuracyM: selected.locationAccuracyM,
        },
      });
      if (verdict === "legit") {
        void triggerAutoResponderCall({
          ...selected,
          status: "legit",
          autoResponderCallAt: selected.autoResponderCallAt ?? null,
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function recordPlan() {
    if (!planDraft.trim()) return;
    setPlan({
      notes: planDraft.trim(),
      recordedAt: new Date().toISOString(),
    });
  }

  if (!ready) {
    return <CommandContentSkeleton fill />;
  }

  if (!selected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
          Incident not found
        </p>
        <p className="max-w-md text-sm text-[var(--muted)]">
          This report is missing, out of scope, or was removed.
        </p>
        <Link
          href="/overview/incidents"
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          ← Back to board
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mb-2">
          <Link
            href="/overview/incidents"
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Incidents board
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ProfileAvatar
            name={selected.citizenName}
            photoURL={selected.citizenPhotoURL}
            seed={selected.citizenUid || selected.citizenName}
            size="sm"
          />
          <h1 className="text-base font-semibold sm:text-lg">{selected.title}</h1>
          <ReportStatusBadge status={selected.status} />
          <Badge variant="outline">
            {hazardHintLabel(selected.hazardHint)}
          </Badge>
          {plan.recordedAt ? (
            <Badge variant="default">Authorized plan recorded</Badge>
          ) : (
            <Badge variant="warn">No authorized plan</Badge>
          )}
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {selected.citizenName} · Brgy. {selected.barangay} ·{" "}
          {selected.citizenPurok}
          {selected.locationLabel
            ? ` · ${selected.locationLabel}`
            : " · location pending"}
          {selected.lat != null && selected.lng != null
            ? ` · ${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
            : ""}
        </p>
      </div>

      <div className="grid lg:grid-cols-2">
        <section className="border-b border-[var(--border)] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
          <PanelEyebrow>1 · Evidence</PanelEyebrow>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Original report
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Citizen media and text as submitted — not yet an ops fact.
          </p>

          <div className="mt-3 aspect-video overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)]">
            {selected.mediaType === "photo" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.mediaUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <video
                src={selected.mediaUrl}
                className="size-full object-cover"
                controls
              />
            )}
          </div>

          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {selected.notes || (
              <span className="text-[var(--muted)]">
                No written notes attached.
              </span>
            )}
          </p>

          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <Meta
              label="Channel"
              value={
                selected.mediaSource === "mobile-camera"
                  ? "Field camera (in-app)"
                  : selected.mediaSource === "desktop-file"
                    ? "Relay / desk upload"
                    : "In-app report"
              }
            />
            <Meta
              label="AI signal"
              value={
                selected.aiReason
                  ? `${selected.aiSource ?? "ai"}${
                      selected.aiConfidence != null
                        ? ` · ${Math.round(selected.aiConfidence * 100)}%`
                        : ""
                    }`
                  : "Pending"
              }
            />
            <Meta
              label="Trust"
              value={
                selected.trustScore != null
                  ? `${selected.trustScore}%${
                      selected.trustBreakdown
                        ? ` · ID ${selected.trustBreakdown.identity} · contact ${selected.trustBreakdown.contact} · capture ${selected.trustBreakdown.capture} · AI ${selected.trustBreakdown.ai}`
                        : ""
                    }`
                  : "Not scored"
              }
            />
            <Meta
              label="Coordinates"
              value={
                selected.lat != null && selected.lng != null
                  ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}`
                  : "Not provided"
              }
            />
            <Meta
              label="Received"
              value={new Date(selected.createdAt).toLocaleString()}
            />
          </dl>

          {selected.aiReason ? (
            <div className="mt-3 border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
              <p className="font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                AI interpretation · proposal only
              </p>
              <p className="mt-1 text-sm">{selected.aiReason}</p>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Related reports
            </p>
            {related.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                No related reports in this barangay yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {related.map((r) => (
                  <li key={r.id}>
                    <Link
                      href={`/overview/incidents/${encodeURIComponent(r.id)}`}
                      className="block w-full border border-[var(--border)] px-2.5 py-2 text-left text-xs transition hover:border-[var(--accent)]"
                    >
                      <span className="font-medium">{r.title}</span>
                      <span className="mt-0.5 block text-[var(--muted)]">
                        {r.citizenName} · {hazardHintLabel(r.hazardHint)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="px-4 py-4 sm:px-5">
          <PanelEyebrow>2 · Decision</PanelEyebrow>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Verify &amp; allocate
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">
            Human verification required. Resource matches use sample inventory
            only.
          </p>

          <div className="mt-3 space-y-2">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Assign investigator
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="min-w-[12rem] flex-1">
                <span className="sr-only">Who will investigate</span>
                <select
                  value={selected.investigatorUid ?? ""}
                  disabled={busy}
                  aria-label="Assign who will investigate"
                  onChange={(e) => {
                    const uid = e.target.value || null;
                    if (!uid) {
                      void assignInvestigator(null, null);
                      return;
                    }
                    const officer = officers.find((o) => o.uid === uid);
                    void assignInvestigator(
                      uid,
                      officer?.displayName || officer?.email || uid,
                    );
                  }}
                  className="w-full border border-[var(--border)] bg-[var(--input)] px-2.5 py-1.5 text-sm outline-none focus:border-[var(--accent)] disabled:opacity-50"
                >
                  <option value="">Unassigned</option>
                  {officers.map((o) => (
                    <option key={o.uid} value={o.uid}>
                      {o.displayName || o.email}
                      {o.officerTitle ? ` · ${o.officerTitle}` : ""}
                    </option>
                  ))}
                  {selected.investigatorUid &&
                  !officers.some((o) => o.uid === selected.investigatorUid) ? (
                    <option value={selected.investigatorUid}>
                      {selected.investigatorName || selected.investigatorUid}
                    </option>
                  ) : null}
                </select>
              </label>
              {isOfficer(profile) &&
              (!selected.investigatorUid ||
                selected.investigatorUid !== profile.uid) ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    void assignInvestigator(
                      profile.uid,
                      profile.displayName || profile.email,
                    )
                  }
                >
                  Assign me
                </Button>
              ) : null}
            </div>
            {selected.investigatorName ? (
              <p className="text-xs text-[var(--muted)]">
                Investigating · {selected.investigatorName}
                {selected.investigatedAt
                  ? ` · assigned ${new Date(selected.investigatedAt).toLocaleString()}`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                Pick an officer who will investigate this incident.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={busy || selected.status === "legit"}
              onClick={() => void override("legit")}
            >
              Mark field-verified
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || selected.status === "rejected"}
              onClick={() => void override("rejected")}
            >
              Reject report
            </Button>
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Unknowns
            </p>
            {unknowns.length === 0 ? (
              <p className="mt-1 text-xs text-[var(--muted)]">
                No critical unknowns flagged from this report.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {unknowns.map((u) => (
                  <li
                    key={u.id}
                    className="border-l-2 border-[var(--warn)] bg-[var(--surface-raised)] px-3 py-2"
                  >
                    <p className="text-sm font-medium">{u.label}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {u.detail}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--warn)] uppercase">
              Recommended next actions · AI proposal
            </p>
            <ul className="mt-2 space-y-2">
              {proposals.map((p) => (
                <li
                  key={p.id}
                  className="border border-[var(--border)] px-3 py-2"
                >
                  <p className="text-sm font-medium">{p.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">{p.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Sample inventory vs need
            </p>
            <ul className="mt-2 divide-y divide-[var(--border)] border border-[var(--border)]">
              {inventory.map((m) => (
                <li
                  key={m.item.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <span>
                    <span className="font-medium">{m.item.label}</span>
                    <span className="mt-0.5 block text-[var(--muted)]">
                      Request draft {m.requested} {m.item.unit} · stock{" "}
                      {m.item.available}
                    </span>
                  </span>
                  {m.canFulfill ? (
                    <Badge variant="outline">Can cover</Badge>
                  ) : (
                    <Badge variant="danger">Unmet · short {m.shortfall}</Badge>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Unmet needs are shown honestly. LUWAS does not invent boats, food,
              or teams.
            </p>
          </div>

          <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
              Authorized response plan
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Edit the draft, then record. This is the human-approved plan —
              distinct from AI proposals above.
            </p>
            <textarea
              value={planDraft}
              onChange={(e) => setPlanDraft(e.target.value)}
              rows={3}
              placeholder="e.g. Contact reporter · assign 1 BRTS for eyes-on · hold boat until location confirmed…"
              className="mt-2 w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!planDraft.trim()}
                onClick={recordPlan}
              >
                Record final plan
              </Button>
              {plan.recordedAt ? (
                <span className="text-[11px] text-[var(--muted)]">
                  Recorded {new Date(plan.recordedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="border-t border-[var(--border)]">
        <button
          type="button"
          onClick={() => setActivityOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left sm:px-5"
        >
          <div>
            <PanelEyebrow>3 · Activity</PanelEyebrow>
            <h2 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
              Timeline
            </h2>
          </div>
          <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            {activityOpen ? "Collapse" : "Expand"}
          </span>
        </button>
        {activityOpen ? (
          <ol className="space-y-0 border-t border-[var(--border)] px-4 pb-5 sm:px-5">
            {activity.map((e, i) => (
              <li
                key={e.id}
                className="relative flex gap-3 border-l border-[var(--border)] py-3 pl-4"
              >
                <span
                  className={cn(
                    "absolute top-4 -left-1.5 size-3 rounded-full border-2 border-[var(--surface)]",
                    e.kind === "ai" && "bg-[var(--warn)]",
                    e.kind === "human" && "bg-[var(--accent)]",
                    e.kind === "citizen" && "bg-[var(--foreground)]",
                    e.kind === "system" && "bg-[var(--muted)]",
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-sm font-medium">{e.title}</p>
                    <time className="font-mono text-[10px] text-[var(--muted)]">
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </div>
                  {e.detail ? (
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {e.detail}
                    </p>
                  ) : null}
                  {i === activity.length - 1 && plan.recordedAt ? (
                    <p className="mt-2 text-xs text-[var(--accent)]">
                      Authorized plan: {plan.notes}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : null}
      </section>
    </div>
  );
}

function PanelEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
      {children}
    </p>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
      <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--foreground)]">{value}</dd>
    </div>
  );
}
