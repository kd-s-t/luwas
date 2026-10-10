"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/AuthProvider";
import { isOfficer } from "@/lib/auth/types";
import { subscribeAllReports, updateReportValidation } from "@/lib/reports/api";
import {
  reportInScope,
  scopeAnchor,
  scopeForProfile,
  scopeLabel,
  sortReportsByDistance,
} from "@/lib/reports/barangayScope";
import { ensureAllMapReportsInDb } from "@/lib/reports/seedMapReport";
import {
  hazardHintLabel,
  type HazardReport,
} from "@/lib/reports/types";
import { useScenario } from "@/lib/scenarios";
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

export function IncidentWorkspace() {
  const { profile } = useAuth();
  const { officerBundle } = useScenario();
  const [rows, setRows] = useState<HazardReport[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(true);
  const [plans, setPlans] = useState<Record<string, PlanState>>({});
  const [planDraft, setPlanDraft] = useState("");

  const scope = useMemo(() => scopeForProfile(profile), [profile]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        await ensureAllMapReportsInDb();
      } catch (err) {
        console.warn("Map report seed failed", err);
      }
      if (cancelled) return;
      unsub = subscribeAllReports(setRows);
    })();
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const scoped = useMemo(
    () => rows.filter((r) => reportInScope(r, scope)),
    [rows, scope],
  );

  const ranked = useMemo(
    () =>
      sortReportsByDistance(scoped, scopeAnchor(scope)).map((x) => x.report),
    [scoped, scope],
  );

  useEffect(() => {
    if (ranked.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !ranked.some((r) => r.id === selectedId)) {
      setSelectedId(ranked[0].id);
    }
  }, [ranked, selectedId]);

  const selected = ranked.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setPlanDraft("");
      return;
    }
    setPlanDraft(plans[selected.id]?.notes ?? "");
  }, [selected, plans]);

  const unknowns = selected ? unknownsForReport(selected) : [];
  const proposals = selected ? proposalsForReport(selected) : [];
  const related = selected ? relatedReports(selected, ranked) : [];
  const activity = selected ? activityForReport(selected) : [];
  const inventory = selected
    ? matchInventoryForHazard(selected.hazardHint)
    : [];
  const plan = selected ? plans[selected.id] : undefined;

  const queueCount = ranked.filter((r) =>
    ["queued", "validating", "needs_review", "failed"].includes(r.status),
  ).length;

  async function override(report: HazardReport, verdict: "legit" | "rejected") {
    setBusyId(report.id);
    try {
      await updateReportValidation(report.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: report.aiConfidence ?? 1,
        aiReason:
          `Officer override → ${verdict}. ${report.aiReason ?? ""}`.trim(),
        aiSource: report.aiSource,
        aiModel: report.aiModel,
        validatedAt: new Date().toISOString(),
        trustInput: {
          registered: Boolean(report.citizenUid),
          idVerified: report.reporterIdVerified,
          email: report.reporterEmail,
          phone: report.reporterPhone,
          emailVerified: report.reporterEmailVerified,
          mediaSource: report.mediaSource,
          lat: report.lat,
          lng: report.lng,
          locationAccuracyM: report.locationAccuracyM,
        },
      });
    } finally {
      setBusyId(null);
    }
  }

  function recordPlan() {
    if (!selected || !planDraft.trim()) return;
    setPlans((prev) => ({
      ...prev,
      [selected.id]: {
        notes: planDraft.trim(),
        recordedAt: new Date().toISOString(),
      },
    }));
  }

  const orgHint = isOfficer(profile) ? profile.orgName : null;

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] bg-[var(--surface-raised)]/90 px-4 py-3 sm:px-6">
        <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
          Incident workspace
        </p>
        <div className="mt-0.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide sm:text-2xl">
              {officerBundle.shortLabel} · {scopeLabel(scope)}
            </h1>
            <p className="text-xs text-[var(--muted)]">
              {queueCount} awaiting review · evidence → decision → activity
              {orgHint ? ` · ${orgHint}` : ""}
            </p>
          </div>
          <p className="max-w-sm text-right text-[11px] text-[var(--muted)]">
            AI proposals are not authorized plans. Verify before allocating aid.
          </p>
        </div>
      </div>

      {ranked.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
            No field reports in scope yet
          </p>
          <p className="max-w-md text-sm text-[var(--muted)]">
            When citizens or relay channels post reports for {scopeLabel(scope)},
            they appear here for evidence review and human decisions. Switch to
            Map for the situation overlay, or open Field reports to manage the
            full queue.
          </p>
        </div>
      ) : (
        <div className="grid flex-1 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr]">
          {/* Incident list */}
          <aside className="max-h-[40dvh] overflow-y-auto border-b border-[var(--border)] lg:max-h-none lg:border-r lg:border-b-0">
            <ul className="divide-y divide-[var(--border)]">
              {ranked.map((r) => {
                const active = r.id === selectedId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className={cn(
                        "w-full px-3 py-3 text-left transition",
                        active
                          ? "bg-[var(--surface-panel)]"
                          : "hover:bg-[var(--surface-raised)]",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-medium leading-snug">
                          {r.title}
                        </p>
                        <ReportStatusBadge status={r.status} />
                      </div>
                      <p className="mt-1 font-mono text-[10px] tracking-wide text-[var(--muted)] uppercase">
                        {hazardHintLabel(r.hazardHint)} · Brgy. {r.barangay}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        {r.citizenName} ·{" "}
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {selected ? (
            <div className="flex min-w-0 flex-col">
              {/* Persistent summary */}
              <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <ProfileAvatar
                    name={selected.citizenName}
                    photoURL={selected.citizenPhotoURL}
                    size="sm"
                  />
                  <h2 className="text-base font-semibold sm:text-lg">
                    {selected.title}
                  </h2>
                  <ReportStatusBadge status={selected.status} />
                  <Badge variant="outline">
                    {hazardHintLabel(selected.hazardHint)}
                  </Badge>
                  {plan?.recordedAt ? (
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
                </p>
              </div>

              {/* Evidence | Decision */}
              <div className="grid flex-1 lg:grid-cols-2">
                <section className="border-b border-[var(--border)] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
                  <PanelEyebrow>1 · Evidence</PanelEyebrow>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                    Original report
                  </h3>
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
                            <button
                              type="button"
                              onClick={() => setSelectedId(r.id)}
                              className="w-full border border-[var(--border)] px-2.5 py-2 text-left text-xs transition hover:border-[var(--accent)]"
                            >
                              <span className="font-medium">{r.title}</span>
                              <span className="mt-0.5 block text-[var(--muted)]">
                                {r.citizenName} ·{" "}
                                {hazardHintLabel(r.hazardHint)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                <section className="px-4 py-4 sm:px-5">
                  <PanelEyebrow>2 · Decision</PanelEyebrow>
                  <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
                    Verify &amp; allocate
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--muted)]">
                    Human verification required. Resource matches use sample
                    inventory only.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        busyId === selected.id || selected.status === "legit"
                      }
                      onClick={() => override(selected, "legit")}
                    >
                      Mark field-verified
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        busyId === selected.id ||
                        selected.status === "rejected"
                      }
                      onClick={() => override(selected, "rejected")}
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
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            {p.detail}
                          </p>
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
                            <Badge variant="danger">
                              Unmet · short {m.shortfall}
                            </Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-[11px] text-[var(--muted)]">
                      Unmet needs are shown honestly. LUWAS does not invent
                      boats, food, or teams.
                    </p>
                  </div>

                  <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
                    <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
                      Authorized response plan
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Edit the draft, then record. This is the human-approved
                      plan — distinct from AI proposals above.
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
                      {plan?.recordedAt ? (
                        <span className="text-[11px] text-[var(--muted)]">
                          Recorded{" "}
                          {new Date(plan.recordedAt).toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </section>
              </div>

              {/* Activity */}
              <section className="border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setActivityOpen((o) => !o)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left sm:px-5"
                >
                  <div>
                    <PanelEyebrow>3 · Activity</PanelEyebrow>
                    <h3 className="font-[family-name:var(--font-display)] text-base font-semibold tracking-wide">
                      Timeline
                    </h3>
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
                          {i === activity.length - 1 && plan?.recordedAt ? (
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
          ) : null}
        </div>
      )}
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
