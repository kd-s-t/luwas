"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCommandWorkspace } from "@/components/CommandWorkspaceProvider";
import { CommandContentSkeleton } from "@/components/PageLoadSkeleton";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ReportStatusBadge } from "@/components/ReportStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  dispatchBarangayInventoryItem,
  ensureActiveBarangayInventory,
  subscribeBarangayInventory,
} from "@/lib/inventory/api";
import { suggestInventoryForHazard } from "@/lib/inventory/suggestForHazard";
import {
  formatInventoryDispatchWhen,
  inventoryAssignedToReport,
  type InventoryItem,
} from "@/lib/inventory/types";
import {
  APAS_BARANGAY_DOC_ID,
  APAS_STAFF_SEED,
} from "@/lib/staff/apasStaff";
import { subscribeBarangayStaff } from "@/lib/staff/api";
import {
  NANGKA_BARANGAY_ID,
  NANGKA_STAFF_SEED,
} from "@/lib/staff/nangkaStaff";
import type { StaffMember } from "@/lib/staff/types";
import { STAFF_RANK_ORDER } from "@/lib/staff/types";
import {
  looksLikeFire,
  triggerAutoResponderCall,
} from "@/lib/alerts/autoResponderCall";
import { triggerInvestigatorNotify } from "@/lib/alerts/notifyInvestigator";
import { triggerReportDoneNotify } from "@/lib/alerts/notifyReportDone";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  isDeveloper,
  isOfficer,
  type OfficerProfile,
} from "@/lib/auth/types";
import {
  addReportFieldEvidence,
  assignReportInvestigator,
  setReportAssignees,
  setReportManualDispatchChecked,
  subscribeHazardReportById,
  updateReportStatus,
  updateReportValidation,
} from "@/lib/reports/api";
import {
  assigneeLabel,
  reportHasAssignee,
} from "@/lib/reports/assignees";
import { reportInScope } from "@/lib/reports/barangayScope";
import { syncHazardReportToBigQuery } from "@/lib/reports/bigquerySync";
import {
  hazardHintLabel,
  reportPriorityLabel,
  type HazardReport,
  type ReportAssignee,
  type ReportStatus,
} from "@/lib/reports/types";
import {
  TRUST_CAPS,
  trustLabel,
  type ReportTrustBreakdown,
} from "@/lib/reports/trustScore";
import { cn } from "@/lib/utils";
import {
  displayReportNotes,
  displayVoiceNoteLabel,
} from "@/lib/reports/displayNotes";
import {
  activityForReport,
  proposalsForReport,
  relatedReports,
  unknownsForReport,
} from "@/lib/workspace/incidentDerived";
import { parseReportNeed } from "@/lib/workspace/reportNeed";
import { matchPlace } from "@/lib/reports/serviceAreaPlaces";
import { doc, updateDoc } from "firebase/firestore";
import { getClientDb } from "@/lib/firebase/client";

const HallPinMap = dynamic(() => import("@/components/HallPinMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[120px] w-full max-w-xs items-center justify-center border border-[var(--border)] bg-[var(--surface)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
      Loading map…
    </div>
  ),
});

/** Map center for the report pin the citizen set (GPS or manual). */
function pinCenterForReport(
  report: HazardReport,
): { lat: number; lng: number } | null {
  if (report.lat != null && report.lng != null) {
    return { lat: report.lat, lng: report.lng };
  }
  // Draft / incomplete: fall back to curated place from the label only.
  const label = report.locationLabel?.trim() ?? "";
  if (label) {
    const matched = matchPlace(label);
    if (matched) return { lat: matched.lat, lng: matched.lng };
  }
  return null;
}

type PlanState = {
  notes: string;
  recordedAt: string | null;
};

type IncidentDetailProps = {
  reportId: string;
  /** Override board back-link (developer console uses /dev/incidents). */
  backHref?: string;
};

export function IncidentDetail({
  reportId,
  backHref = "/admin/incidents",
}: IncidentDetailProps) {
  const { profile } = useAuth();
  const {
    reportScope,
    scopedReports,
    activeOfficers,
  } = useCommandWorkspace();
  const [busy, setBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(true);
  const [plan, setPlan] = useState<PlanState>({ notes: "", recordedAt: null });
  const [planDraft, setPlanDraft] = useState("");
  const [fieldReport, setFieldReport] = useState<PlanState>({
    notes: "",
    recordedAt: null,
  });
  const [fieldReportDraft, setFieldReportDraft] = useState("");
  const [directReport, setDirectReport] = useState<HazardReport | null>(null);
  const [directReady, setDirectReady] = useState(false);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryBusy, setInventoryBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [staffRows, setStaffRows] = useState<StaffMember[]>([]);
  const assignWrapRef = useRef<HTMLDivElement | null>(null);

  const scoped = scopedReports;
  const officers = activeOfficers;
  const globalView = isDeveloper(profile);

  const inventoryBarangayId = useMemo(() => {
    if (!isOfficer(profile)) return NANGKA_BARANGAY_ID;
    const areaId = (profile.areaId ?? profile.activeBarangayId)?.trim() ?? "";
    if (areaId.includes("apas")) return APAS_BARANGAY_DOC_ID;
    return NANGKA_BARANGAY_ID;
  }, [profile]);

  const isApasArea = inventoryBarangayId === APAS_BARANGAY_DOC_ID;

  useEffect(() => {
    setDirectReady(false);
    setDirectReport(null);
    return subscribeHazardReportById(reportId, (row) => {
      setDirectReport(row);
      setDirectReady(true);
    });
  }, [reportId]);

  useEffect(() => {
    if (!isOfficer(profile)) {
      setInventory([]);
      return;
    }
    void ensureActiveBarangayInventory().catch(() => {});
    return subscribeBarangayInventory(inventoryBarangayId, setInventory);
  }, [profile, inventoryBarangayId]);

  useEffect(() => {
    if (!isOfficer(profile)) {
      setStaffRows([]);
      return;
    }
    return subscribeBarangayStaff(inventoryBarangayId, setStaffRows);
  }, [profile, inventoryBarangayId]);

  /** Active staff roster for Assign (not only logged-in app accounts). */
  const assignOptions = useMemo(() => {
    type Opt = { uid: string; name: string; title: string; staffId: string };
    const seed = (
      isApasArea ? APAS_STAFF_SEED : NANGKA_STAFF_SEED
    ).filter((s) => s.status === "active" && s.scope === "barangay");
    const seedIds = new Set(seed.map((s) => s.id));
    const live = staffRows.filter(
      (s) => s.status === "active" && s.scope === "barangay",
    );
    const roster = live.length > 0 ? live : seed;

    const byEmail = new Map(
      officers.map((o) => [o.email.trim().toLowerCase(), o] as const),
    );
    const byStaffId = new Map(
      officers
        .filter((o) => o.staffId)
        .map((o) => [o.staffId!, o] as const),
    );

    function personKey(name: string, title: string): string {
      return `${name.trim().toLowerCase()}|${title.trim().toLowerCase()}`;
    }

    /** Prefer real account uid, then canonical seed staff id. */
    function betterOpt(next: Opt, prev: Opt | undefined): Opt {
      if (!prev) return next;
      const nextAccount = !next.uid.startsWith("staff:");
      const prevAccount = !prev.uid.startsWith("staff:");
      if (nextAccount !== prevAccount) return nextAccount ? next : prev;
      const nextSeed = seedIds.has(next.staffId);
      const prevSeed = seedIds.has(prev.staffId);
      if (nextSeed !== prevSeed) return nextSeed ? next : prev;
      return prev;
    }

    // Dedupe by person (name+title) — live DB can have duplicate staff rows.
    const byPerson = new Map<string, Opt>();
    for (const s of roster) {
      const email = (s.accountEmail ?? s.email).trim().toLowerCase();
      const account =
        byStaffId.get(s.id) || (email ? byEmail.get(email) : undefined);
      const uid = account?.uid ?? `staff:${s.id}`;
      const opt: Opt = {
        uid,
        name: s.displayName,
        title: s.title,
        staffId: s.id,
      };
      const key = personKey(opt.name, opt.title);
      byPerson.set(key, betterOpt(opt, byPerson.get(key)));
    }

    const out = new Map<string, Opt>();
    for (const opt of byPerson.values()) {
      out.set(opt.uid, opt);
    }
    for (const o of officers) {
      if (out.has(o.uid)) continue;
      const key = personKey(o.displayName || o.email, o.officerTitle || "");
      const existing = [...out.values()].find(
        (x) => personKey(x.name, x.title) === key,
      );
      if (existing) {
        // Collapse staff:… row into the real officer account.
        if (existing.uid.startsWith("staff:")) {
          out.delete(existing.uid);
          out.set(o.uid, {
            uid: o.uid,
            name: o.displayName || o.email,
            title: o.officerTitle || existing.title,
            staffId: o.staffId || existing.staffId,
          });
        }
        continue;
      }
      out.set(o.uid, {
        uid: o.uid,
        name: o.displayName || o.email,
        title: o.officerTitle || "",
        staffId: o.staffId || "",
      });
    }
    return [...out.values()].sort((a, b) => {
      const seedA = seed.find((s) => s.id === a.staffId);
      const seedB = seed.find((s) => s.id === b.staffId);
      const ra = seedA ? (STAFF_RANK_ORDER[seedA.rank] ?? 99) : 99;
      const rb = seedB ? (STAFF_RANK_ORDER[seedB.rank] ?? 99) : 99;
      if (ra !== rb) return ra - rb;
      return a.name.localeCompare(b.name);
    });
  }, [staffRows, officers, isApasArea]);

  useEffect(() => {
    if (!assignOpen) return;
    function onPointerDown(e: PointerEvent) {
      const el = assignWrapRef.current;
      if (el && !el.contains(e.target as Node)) setAssignOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAssignOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [assignOpen]);

  const fromList = useMemo(
    () => scoped.find((r) => r.id === reportId) ?? null,
    [scoped, reportId],
  );
  const candidate = fromList ?? directReport;
  const selected =
    candidate &&
    (globalView || reportInScope(candidate, reportScope))
      ? candidate
      : null;
  const loading = !selected && !directReady;

  useEffect(() => {
    if (!selected) {
      setPlanDraft("");
      setPlan({ notes: "", recordedAt: null });
      setFieldReportDraft("");
      setFieldReport({ notes: "", recordedAt: null });
      return;
    }
    setPlanDraft("");
    setPlan({ notes: "", recordedAt: null });
    setFieldReportDraft("");
    setFieldReport({ notes: "", recordedAt: null });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- reset when incident changes

  const fireBackfillRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || !isOfficer(profile)) return;
    if (selected.status !== "legit") return;
    if (selected.autoResponderCallAt) return;
    const fire =
      selected.hazardHint === "fire" ||
      looksLikeFire(
        selected.title,
        selected.notes,
        selected.voiceTranscript,
        selected.aiReason,
      );
    if (!fire) return;
    if (fireBackfillRef.current === selected.id) return;
    fireBackfillRef.current = selected.id;
    void (async () => {
      if (selected.hazardHint !== "fire") {
        await updateDoc(doc(getClientDb(), "reports", selected.id), {
          hazardHint: "fire",
          updatedAt: new Date().toISOString(),
        });
      }
      await triggerAutoResponderCall({
        ...selected,
        hazardHint: "fire",
        status: "legit",
        autoResponderCallAt: null,
      });
    })().catch((err) => {
      console.warn("Fire BFP backfill failed", err);
      fireBackfillRef.current = null;
    });
  }, [selected, profile]);

  const unknowns = selected ? unknownsForReport(selected) : [];
  const proposals = selected ? proposalsForReport(selected) : [];
  const related = selected ? relatedReports(selected, scoped) : [];
  const activity = selected ? activityForReport(selected) : [];
  const inventorySuggestions = selected
    ? suggestInventoryForHazard(selected.hazardHint, inventory)
    : [];
  const inventoryOnThisTicket = selected
    ? inventoryAssignedToReport(inventory, selected.id)
    : [];

  async function dispatchSuggestedStock(item: InventoryItem) {
    if (!isOfficer(profile) || inventoryBusy) return;
    setInventoryBusy(true);
    try {
      await dispatchBarangayInventoryItem({
        id: item.id,
        qty: 1,
        byUid: profile.uid,
        byName: profile.displayName?.trim() || profile.email || "Officer",
        reportId: selected?.id,
        note: selected ? `Incident ${selected.id}` : undefined,
      });
    } finally {
      setInventoryBusy(false);
    }
  }

  function assigneesOf(report: HazardReport): ReportAssignee[] {
    return report.assignees?.length
      ? report.assignees
      : report.investigatorUid
        ? [
            {
              uid: report.investigatorUid,
              name: report.investigatorName || report.investigatorUid,
              assignedAt: report.investigatedAt || report.updatedAt,
            },
          ]
        : [];
  }

  async function saveAssignees(
    next: { uid: string; name: string }[],
    notifyUid?: string,
  ) {
    if (!selected) return;
    setBusy(true);
    setStatusError(null);
    try {
      await setReportAssignees({
        reportId: selected.id,
        assignees: next,
      });
      if (notifyUid) {
        const row = next.find((a) => a.uid === notifyUid);
        if (row) {
          const officer = officers.find((o) => o.uid === row.uid);
          const opt = assignOptions.find((o) => o.uid === row.uid);
          const staffId =
            officer?.staffId ||
            opt?.staffId ||
            (row.uid.startsWith("staff:") ? row.uid.slice(6) : null);
          const staff =
            APAS_STAFF_SEED.find((s) => s.id === staffId) ||
            NANGKA_STAFF_SEED.find((s) => s.id === staffId) ||
            staffRows.find((s) => s.id === staffId) ||
            [...APAS_STAFF_SEED, ...NANGKA_STAFF_SEED].find(
              (s) =>
                s.displayName.toLowerCase() === row.name.trim().toLowerCase(),
            );
          void triggerInvestigatorNotify({
            report: selected,
            investigatorUid: row.uid,
            investigatorName: row.name,
            phone: staff?.phone ?? null,
            staffId: staffId ?? staff?.id ?? null,
            email: officer?.email ?? staff?.email ?? null,
          });
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleAssignee(uid: string, name: string) {
    if (!selected) return;
    const current = assigneesOf(selected);
    const exists = current.some((a) => a.uid === uid);
    const next = exists
      ? current
          .filter((a) => a.uid !== uid)
          .map((a) => ({ uid: a.uid, name: a.name }))
      : [...current.map((a) => ({ uid: a.uid, name: a.name })), { uid, name }];
    await saveAssignees(next, exists ? undefined : uid);
  }

  async function assignInvestigator(
    investigatorUid: string | null,
    investigatorName: string | null,
  ) {
    if (!investigatorUid) {
      await saveAssignees([]);
      return;
    }
    await saveAssignees(
      [{ uid: investigatorUid, name: investigatorName || investigatorUid }],
      investigatorUid,
    );
  }

  async function override(verdict: "legit" | "rejected") {
    if (!selected) return;
    setBusy(true);
    try {
      const validatedAt = new Date().toISOString();
      const fire =
        selected.hazardHint === "fire" ||
        looksLikeFire(
          selected.title,
          selected.notes,
          selected.voiceTranscript,
          selected.aiReason,
        );
      const hazardHint = fire ? ("fire" as const) : selected.hazardHint;
      await updateReportValidation(selected.id, {
        status: verdict,
        aiVerdict: verdict,
        aiConfidence: selected.aiConfidence ?? 1,
        aiReason:
          `Officer override → ${verdict}. ${selected.aiReason ?? ""}`.trim(),
        aiSource: selected.aiSource,
        aiModel: selected.aiModel,
        ...(hazardHint !== selected.hazardHint ? { hazardHint } : {}),
        validatedAt,
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
          vertexClass: selected.vertexClass,
          vertexConfidence: selected.vertexConfidence,
          vertexLocationPlaceId: selected.vertexLocationPlaceId,
          vertexLocationLabel: selected.vertexLocationLabel,
          vertexLocationConfidence: selected.vertexLocationConfidence,
        },
      });
      if (verdict === "rejected" && isOfficer(profile)) {
        await assignReportInvestigator({
          reportId: selected.id,
          investigatorUid: profile.uid,
          investigatorName: profile.displayName,
        });
      }
      syncHazardReportToBigQuery({
        ...selected,
        status: verdict,
        aiVerdict: verdict,
        hazardHint,
        validatedAt,
        ...(verdict === "rejected" && isOfficer(profile)
          ? {
              assignees: [
                {
                  uid: profile.uid,
                  name: profile.displayName || profile.email,
                  assignedAt: validatedAt,
                },
              ],
              investigatorUid: profile.uid,
              investigatorName: profile.displayName,
              investigatedAt: validatedAt,
            }
          : {}),
      });
      if (verdict === "legit") {
        void triggerAutoResponderCall({
          ...selected,
          hazardHint,
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

  async function advanceStatus(next: ReportStatus) {
    if (!selected) return;
    if (next === "dispatched" && !reportHasAssignee(selected)) {
      setStatusError("Assign an officer before marking dispatched.");
      return;
    }
    if (next === "done" && !fieldReport.recordedAt && !fieldReportDraft.trim()) {
      setStatusError("Fill the field report before marking done.");
      return;
    }
    setStatusError(null);
    setBusy(true);
    try {
      if (next === "legit") {
        await override("legit");
        return;
      }
      if (
        next === "assigned" &&
        isOfficer(profile) &&
        !reportHasAssignee(selected)
      ) {
        await assignInvestigator(
          profile.uid,
          profile.displayName || profile.email,
        );
        return;
      }
      if (
        next === "done" &&
        !fieldReport.recordedAt &&
        fieldReportDraft.trim()
      ) {
        setFieldReport({
          notes: fieldReportDraft.trim(),
          recordedAt: new Date().toISOString(),
        });
      }
      await updateReportStatus(selected.id, next);
      if (next === "done") {
        void triggerReportDoneNotify({
          report: selected,
          officers,
          staffRows,
          isApasArea,
          closedByName: profile?.displayName || profile?.email || "Officer",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const pipelineNext: { status: ReportStatus; label: string } | null =
    !selected
      ? null
      : selected.status === "queued" ||
          selected.status === "validating" ||
          selected.status === "needs_review" ||
          selected.status === "failed"
        ? { status: "assigned", label: "Move to assigned" }
        : selected.status === "assigned"
          ? { status: "legit", label: "Mark field-verified" }
          : selected.status === "legit"
            ? { status: "dispatched", label: "Mark dispatched" }
            : selected.status === "dispatched"
              ? { status: "done", label: "Mark done" }
              : null;

  if (loading) {
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
          href={backHref}
          className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
        >
          ← Back to board
        </Link>
      </div>
    );
  }

  const reportNeed = parseReportNeed(selected);
  const showResourceShortage =
    reportNeed.short &&
    (selected.status === "legit" ||
      selected.status === "queued" ||
      selected.status === "assigned");

  return (
    <div className="flex flex-col bg-[var(--surface)]">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)]/95 px-4 py-3 backdrop-blur sm:px-5">
        <div className="mb-2 flex items-start justify-between gap-3">
          <Link
            href={backHref}
            className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase transition hover:text-[var(--accent)]"
          >
            ← Incidents board
          </Link>
          <p className="shrink-0 text-right font-mono text-[10px] leading-snug tracking-wide text-[var(--muted)] uppercase">
            Received
            <span className="mt-0.5 block normal-case tracking-normal text-[var(--foreground)]">
              {new Date(selected.createdAt).toLocaleString("en-PH", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
          </p>
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
        {showResourceShortage ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-3 py-2">
            <div className="min-w-0">
              <p className="font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                Resource shortage
              </p>
              <p className="mt-0.5 text-sm text-[var(--foreground)]">
                Local stock cannot cover {reportNeed.neededLabel}.{" "}
                {reportNeed.householdsLabel}.
              </p>
            </div>
            <Link
              href={`/admin/resources/assist?report=${encodeURIComponent(selected.id)}`}
              className="shrink-0 border border-[var(--foreground)] rounded-xl bg-[var(--foreground)] px-3 py-1.5 font-mono text-[10px] tracking-wider text-white uppercase transition hover:opacity-90"
            >
              Find assistance
            </Link>
          </div>
        ) : null}
      </div>

      <div className="grid lg:grid-cols-2">
        <section className="border-b border-[var(--border)] px-4 py-4 sm:px-5 lg:border-r lg:border-b-0">
          <PanelEyebrow>1 · Evidence</PanelEyebrow>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold tracking-wide">
            Original report
          </h2>

          {selected.mediaUrl?.trim() && selected.mediaType === "photo" ? (
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="mt-3 flex aspect-video w-full cursor-zoom-in items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)] transition hover:border-[var(--accent)]/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
                  aria-label="View original report photo"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.mediaUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
                <DialogHeader className="px-4 pt-4 pr-12 pb-3">
                  <DialogTitle className="text-lg">Original report</DialogTitle>
                  <DialogDescription>
                    Full-size evidence photo
                  </DialogDescription>
                </DialogHeader>
                <DialogBody className="bg-[var(--surface-panel)] p-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selected.mediaUrl}
                    alt="Original report evidence"
                    className="max-h-[min(70vh,36rem)] w-full object-contain"
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          ) : (
            <div className="mt-3 flex aspect-video items-center justify-center overflow-hidden border border-[var(--border)] bg-[var(--surface-panel)]">
              {selected.mediaUrl?.trim() ? (
                <video
                  src={selected.mediaUrl}
                  className="size-full object-cover"
                  controls
                />
              ) : (
                <p className="text-sm font-medium text-[var(--muted)]">
                  No image
                </p>
              )}
            </div>
          )}

          <div className="mt-3 border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brands/vertex-ai.svg"
                alt=""
                title="Vertex AI"
                className="h-4 w-auto shrink-0"
              />
              <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                Vertex AI · image class + location
              </p>
            </div>
            <p className="mt-1.5 text-sm text-[var(--foreground)]">
              {selected.vertexClass?.trim()
                ? selected.vertexClass.trim()
                : "No classification yet"}
              {selected.vertexConfidence != null
                ? ` · ${Math.round(selected.vertexConfidence * 100)}%`
                : ""}
            </p>
            {selected.vertexLocationPlaceLabel?.trim() ||
            selected.vertexLocationLabel?.trim() ? (
              <p className="mt-1 text-sm text-[var(--muted)]">
                Place:{" "}
                <span className="text-[var(--foreground)]">
                  {selected.vertexLocationPlaceLabel?.trim() ||
                    selected.vertexLocationLabel?.trim()}
                </span>
                {selected.vertexLocationConfidence != null
                  ? ` · ${Math.round(selected.vertexLocationConfidence * 100)}%`
                  : ""}
              </p>
            ) : null}
          </div>

          {(() => {
            const notes = displayReportNotes(selected.notes);
            return notes ? (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
                {notes}
              </p>
            ) : !selected.voiceUrl && !selected.voiceTranscript ? (
              <p className="mt-3 text-sm text-[var(--muted)]">
                No written notes attached.
              </p>
            ) : null;
          })()}

          {selected.voiceUrl || selected.voiceTranscript ? (
            <div className="mt-3 space-y-1.5 rounded border border-[var(--border)] bg-[var(--surface-panel)] px-3 py-2.5">
              <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                Voice note
                {(() => {
                  const when = displayVoiceNoteLabel(selected.voiceNoteLabel);
                  return when ? ` · ${when}` : "";
                })()}
              </p>
              {selected.voiceUrl ? (
                <audio
                  controls
                  preload="metadata"
                  src={selected.voiceUrl}
                  className="h-9 w-full"
                >
                  <track kind="captions" />
                </audio>
              ) : null}
              {selected.voiceTranscript ? (
                <p className="text-sm leading-relaxed break-words">
                  {selected.voiceTranscript}
                </p>
              ) : null}
            </div>
          ) : null}

          <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
            <div className="border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-2">
              <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                AI check
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-[var(--foreground)]">
                {selected.aiSource === "gemini" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src="/brands/gemini.png"
                    alt=""
                    title="Gemini"
                    className="h-3.5 w-auto shrink-0 opacity-80"
                  />
                ) : null}
                <span>
                  {selected.aiReason
                    ? `${
                        selected.aiSource === "gemini"
                          ? "Gemini"
                          : selected.aiSource === "local"
                            ? "local rules"
                            : (selected.aiSource ?? "AI")
                      }${
                        selected.aiConfidence != null
                          ? ` · ${Math.round(selected.aiConfidence * 100)}%`
                          : ""
                      }`
                    : "Pending"}
                </span>
              </dd>
            </div>
            <Meta
              label="Priority"
              value={
                selected.aiPriority
                  ? reportPriorityLabel(selected.aiPriority)
                  : "Pending AI"
              }
            />
          </dl>

          <div className="mt-3">
            <p className="mb-1.5 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
              Location
            </p>
            <dl className="grid gap-3 text-xs sm:grid-cols-2">
              {(() => {
                const pin = pinCenterForReport(selected);
                const pinLabel =
                  selected.locationLabel?.trim() ||
                  [
                    selected.citizenPurok?.trim(),
                    selected.barangay
                      ? `Brgy. ${selected.barangay}`
                      : null,
                    selected.lgu?.trim(),
                  ]
                    .filter(Boolean)
                    .join(", ") ||
                  "Place not provided";
                return (
                  <div>
                    <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                      Reported place
                    </dt>
                    <dd className="mt-0.5 text-[var(--foreground)]">
                      {pinLabel}
                    </dd>
                    {pin ? (
                      <>
                        <dd className="mt-0.5 font-mono tabular-nums text-[var(--muted)]">
                          {pin.lat.toFixed(5)}, {pin.lng.toFixed(5)}
                        </dd>
                        <dd className="mt-1.5">
                          <HallPinMap
                            center={pin}
                            zoom={15}
                            readOnly
                            className="relative h-[120px] w-full overflow-hidden border border-[var(--border)]"
                          />
                        </dd>
                      </>
                    ) : (
                      <dd className="mt-1.5 border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-3 font-mono text-[10px] text-[var(--muted)]">
                        Place not available
                      </dd>
                    )}
                  </div>
                );
              })()}
              <div>
                <dt className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                  Location of the pin
                </dt>
                <dd className="mt-0.5 font-mono tabular-nums text-[var(--foreground)]">
                  {selected.lat != null && selected.lng != null
                    ? `${selected.lat.toFixed(5)}, ${selected.lng.toFixed(5)}${
                        selected.locationAccuracyM != null
                          ? ` · ±${Math.round(selected.locationAccuracyM)} m`
                          : ""
                      }`
                    : "Pin not captured"}
                </dd>
                {selected.device?.trim() ? (
                  <dd className="mt-0.5 text-[var(--muted)]">
                    {selected.device.trim()}
                  </dd>
                ) : null}
                {selected.lat != null && selected.lng != null ? (
                  <dd className="mt-1.5">
                    <HallPinMap
                      center={{ lat: selected.lat, lng: selected.lng }}
                      zoom={16}
                      readOnly
                      className="relative h-[120px] w-full overflow-hidden border border-[var(--border)]"
                    />
                  </dd>
                ) : (
                  <dd className="mt-1.5 border border-[var(--border)] bg-[var(--surface-raised)] px-2.5 py-3 font-mono text-[10px] text-[var(--muted)]">
                    Pin not captured
                  </dd>
                )}
              </div>
            </dl>
          </div>

          <TrustMeter
            score={selected.trustScore}
            breakdown={selected.trustBreakdown}
            aiSource={selected.aiSource}
            hasVertex={Boolean(selected.vertexClass?.trim())}
          />

          {selected.aiReason ? (
            <div className="mt-3 border border-dashed border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2">
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brands/gemini.png"
                  alt=""
                  title="Gemini"
                  className="h-3.5 w-auto shrink-0"
                />
                <p className="font-mono text-[9px] tracking-wider text-[var(--warn)] uppercase">
                  AI interpretation · proposal only
                </p>
              </div>
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
                      href={`${backHref}/${encodeURIComponent(r.id)}`}
                      className="block w-full rounded-xl border border-[var(--border)] px-2.5 py-2 text-left text-xs transition hover:border-[var(--accent)]"
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
            {selected.status === "legit" ||
            selected.status === "assigned" ||
            selected.status === "dispatched" ||
            selected.status === "done"
              ? "Verified. Assign investigators and authorize response."
              : selected.aiVerdict === "legit"
                ? "AI marked this verified. Confirm assignees before dispatch."
                : "Human verification required before any response is authorized."}
          </p>

          <div className="mt-3 space-y-2">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
              Assign investigators
            </p>
            <p className="text-xs text-[var(--muted)]">
              Select one or more officers. Multiple assignees are allowed.
            </p>
            <div ref={assignWrapRef} className="relative">
              <button
                type="button"
                disabled={busy}
                aria-haspopup="listbox"
                aria-expanded={assignOpen}
                onClick={() => setAssignOpen((v) => !v)}
                className="flex w-full items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 py-2 text-left text-sm transition hover:border-[var(--accent)] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate">
                  {assigneesOf(selected).length > 0
                    ? assigneeLabel(assigneesOf(selected))
                    : "Select officers…"}
                </span>
                <span
                  className="shrink-0 text-[10px] text-[var(--muted)]"
                  aria-hidden
                >
                  {assignOpen ? "▴" : "▾"}
                </span>
              </button>
              {assignOpen ? (
                <ul
                  role="listbox"
                  className="absolute z-20 mt-1 max-h-48 w-full space-y-1 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] p-1.5 shadow-md"
                >
                  {isOfficer(profile) ? (
                    <li>
                      <button
                        type="button"
                        role="option"
                        aria-selected={assigneesOf(selected).some(
                          (a) => a.uid === profile.uid,
                        )}
                        disabled={busy}
                        onClick={() =>
                          void toggleAssignee(
                            profile.uid,
                            profile.displayName || profile.email,
                          )
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-[var(--surface-panel)] disabled:opacity-50",
                          assigneesOf(selected).some(
                            (a) => a.uid === profile.uid,
                          ) && "bg-[var(--accent)]/10",
                        )}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          Me · {profile.displayName || profile.email}
                        </span>
                        {assigneesOf(selected).some(
                          (a) => a.uid === profile.uid,
                        ) ? (
                          <span className="text-[11px] font-semibold text-[#16794c]">
                            ✓
                          </span>
                        ) : null}
                      </button>
                    </li>
                  ) : null}
                  {assignOptions
                    .filter((o) => o.uid !== profile?.uid)
                    .map((o) => {
                      const on = assigneesOf(selected).some(
                        (a) => a.uid === o.uid,
                      );
                      return (
                        <li key={o.uid}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={on}
                            disabled={busy}
                            onClick={() =>
                              void toggleAssignee(o.uid, o.name)
                            }
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-[var(--surface-panel)] disabled:opacity-50",
                              on && "bg-[var(--accent)]/10",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {o.name}
                              {o.title ? ` · ${o.title}` : ""}
                            </span>
                            {on ? (
                              <span className="text-[11px] font-semibold text-[#16794c]">
                                ✓
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  {assignOptions.filter((o) => o.uid !== profile?.uid).length ===
                    0 && !isOfficer(profile) ? (
                    <li className="px-2 py-2 text-xs text-[var(--muted)]">
                      No officers available.
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
            {assigneesOf(selected).length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-[var(--muted)]">
                  Investigating · {assigneeLabel(assigneesOf(selected))}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void saveAssignees([])}
                >
                  Clear all
                </Button>
              </div>
            ) : (
              <p className="text-xs text-[var(--muted)]">
                No officers assigned yet.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {pipelineNext ? (
              <Button
                type="button"
                size="sm"
                disabled={
                  busy ||
                  (pipelineNext.status === "dispatched" &&
                    !reportHasAssignee(selected)) ||
                  (pipelineNext.status === "done" &&
                    !fieldReport.recordedAt &&
                    !fieldReportDraft.trim())
                }
                onClick={() => void advanceStatus(pipelineNext.status)}
              >
                {pipelineNext.label}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                busy ||
                selected.status === "rejected" ||
                selected.status === "done"
              }
              onClick={() => void override("rejected")}
            >
              Reject report
            </Button>
          </div>
          {statusError ? (
            <p className="mt-2 text-sm text-[var(--danger)]" role="alert">
              {statusError}
            </p>
          ) : pipelineNext?.status === "dispatched" &&
            !reportHasAssignee(selected) ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Assign an officer before marking dispatched.
            </p>
          ) : pipelineNext?.status === "done" &&
            !fieldReport.recordedAt &&
            !fieldReportDraft.trim() ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Fill the field report before marking done.
            </p>
          ) : null}

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
                  className={cn(
                    "flex gap-2.5 border border-[var(--border)] px-3 py-2",
                    p.done && "border-[var(--accent)]/35 bg-[var(--accent)]/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(p.done)}
                    disabled={busy || !p.manual}
                    readOnly={!p.manual}
                    tabIndex={p.manual ? 0 : -1}
                    aria-label={
                      p.manual
                        ? p.label
                        : p.done
                          ? `${p.label} (done)`
                          : p.label
                    }
                    onChange={
                      p.manual
                        ? (e) => {
                            const checked = e.target.checked;
                            void (async () => {
                              setBusy(true);
                              setStatusError(null);
                              try {
                                if (p.id !== "dispatch") return;
                                await setReportManualDispatchChecked(
                                  selected.id,
                                  checked,
                                );
                                if (checked) {
                                  if (
                                    selected.status === "legit" ||
                                    selected.status === "assigned"
                                  ) {
                                    await updateReportStatus(
                                      selected.id,
                                      "dispatched",
                                    );
                                  }
                                  // Outreach is best-effort; do not undo dispatch.
                                  const call = await triggerAutoResponderCall({
                                    ...selected,
                                    status: "legit",
                                    autoResponderCallAt:
                                      selected.autoResponderCallAt ?? null,
                                  });
                                  if (
                                    call.attempted &&
                                    call.ok === false &&
                                    call.error
                                  ) {
                                    setStatusError(
                                      `Dispatched. Call/SMS: ${call.error}`,
                                    );
                                  }
                                }
                              } catch (err) {
                                setStatusError(
                                  err instanceof Error
                                    ? err.message
                                    : "Could not update dispatch",
                                );
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }
                        : undefined
                    }
                    className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)] disabled:opacity-100"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "text-sm font-medium",
                          p.done && "text-[var(--muted)] line-through",
                        )}
                      >
                        {p.label}
                      </p>
                      {p.brand === "twilio" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src="/brands/twilio.png"
                          alt="Twilio"
                          title="Twilio"
                          className="mt-0.5 h-3.5 w-auto shrink-0 opacity-55"
                        />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--muted)]">
                      {p.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--warn)] uppercase">
                Assigned inventory · on this ticket
              </p>
              <Link
                href="/admin/inventory"
                className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
              >
                Open inventory
              </Link>
            </div>
            {inventoryOnThisTicket.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No barangay stock dispatched to this incident yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {inventoryOnThisTicket.map(({ item, qty, event }) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 border border-[#fdba74]/50 bg-[#fff7ed]/40 px-3 py-2"
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.label}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{item.label}</p>
                        <span className="rounded-full bg-[#fff7ed] px-2 py-0.5 text-[10px] font-semibold text-[#c2410c] ring-1 ring-[#fdba74]/70">
                          Dispatched
                        </span>
                      </div>
                      <p className="text-xs text-[var(--foreground)]">
                        {qty} {item.unit} on this ticket
                        {item.location
                          ? ` · from ${item.location}`
                          : ""}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                        by {event.byName} ·{" "}
                        {formatInventoryDispatchWhen(event.at)}
                        {event.note ? ` · ${event.note}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--warn)] uppercase">
                Suggested inventory · barangay stock
              </p>
              <Link
                href="/admin/inventory"
                className="font-mono text-[10px] tracking-wider text-[var(--accent)] uppercase hover:underline"
              >
                Open inventory
              </Link>
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Matched to {hazardHintLabel(selected.hazardHint)}. Proposal only.
              Confirm before dispatch.
            </p>
            {inventorySuggestions.length === 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                No matching barangay inventory yet. Add stock under Databases →
                Inventory.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {inventorySuggestions.map(({ item, short }) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2"
                  >
                    <div className="relative h-12 w-16 shrink-0 overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.label}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {short
                          ? "Short / unavailable locally"
                          : `${item.available} ${item.unit} on hand`}
                      </p>
                      <p className="mt-1 font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
                        Location
                      </p>
                      <p className="text-xs font-medium text-[var(--foreground)]">
                        {item.location?.trim() || "Location TBD"}
                      </p>
                    </div>
                    {short ? (
                      <Link
                        href={`/admin/resources/assist?report=${encodeURIComponent(selected.id)}`}
                        className="shrink-0 rounded-xl border border-[var(--border)] px-2.5 py-1 font-mono text-[10px] tracking-wider uppercase transition hover:border-[var(--accent)]"
                      >
                        Find assistance
                      </Link>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={inventoryBusy || busy}
                        onClick={() => void dispatchSuggestedStock(item)}
                      >
                        Dispatch 1
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
              Authorized response plan
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Edit the draft, then record. Human-approved plan, distinct from AI
              proposals and the field report.
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

          <div className="mt-4 border border-[var(--border)] bg-[var(--surface-raised)] p-3">
            <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--accent)] uppercase">
              Field report · required before done
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              What the officer found on site. Required to mark done. Not the
              authorized plan.
            </p>
            <textarea
              value={fieldReportDraft}
              onChange={(e) => setFieldReportDraft(e.target.value)}
              rows={3}
              placeholder="e.g. Fire out · structure damaged · no injuries · BFP cleared scene…"
              className="mt-2 w-full resize-y border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!fieldReportDraft.trim()}
                onClick={() => {
                  if (!fieldReportDraft.trim()) return;
                  setFieldReport({
                    notes: fieldReportDraft.trim(),
                    recordedAt: new Date().toISOString(),
                  });
                }}
              >
                Record field report
              </Button>
              {fieldReport.recordedAt ? (
                <span className="text-[11px] text-[var(--muted)]">
                  Recorded {new Date(fieldReport.recordedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
        </section>
      </div>

      <section className="border-t border-[var(--border)] px-4 py-4 sm:px-5">
        <p className="font-mono text-[9px] tracking-[0.16em] text-[var(--muted)] uppercase">
          Field photos · optional
        </p>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          On-site images if available. Not required to mark done.
        </p>
        <label className="mt-2 block">
          <span className="sr-only">Upload field photos</span>
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            disabled={busy || !isOfficer(profile)}
            onChange={(e) => {
              const list = e.target.files;
              if (!list?.length || !profile || !isOfficer(profile)) return;
              const files = Array.from(list).filter((f) =>
                f.type.startsWith("image/"),
              );
              e.target.value = "";
              if (!files.length) return;
              void (async () => {
                setBusy(true);
                try {
                  await addReportFieldEvidence({
                    reportId: selected.id,
                    uploaderUid: profile.uid,
                    uploaderName:
                      profile.displayName || profile.email || null,
                    files,
                  });
                } catch (err) {
                  console.error(err);
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="block w-full text-sm text-[var(--muted)] file:mr-3 file:border file:border-[var(--border)] file:bg-[var(--surface)] file:px-3 file:py-1.5 file:text-sm file:text-[var(--fg)] disabled:opacity-50"
          />
        </label>
        {selected.fieldEvidence?.length ? (
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selected.fieldEvidence.map((img) => (
              <li
                key={img.mediaPath}
                className="overflow-hidden border border-[var(--border)] bg-[var(--surface-raised)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.mediaUrl}
                  alt="Field evidence"
                  className="aspect-[4/3] w-full object-cover"
                />
                {img.uploadedByName ? (
                  <p className="truncate px-2 py-1 text-[10px] text-[var(--muted)]">
                    {img.uploadedByName}
                    {img.uploadedAt
                      ? ` · ${new Date(img.uploadedAt).toLocaleString()}`
                      : ""}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-[var(--muted)]">No field photos yet.</p>
        )}
      </section>

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

function TrustMeter({
  score,
  breakdown,
  aiSource,
  hasVertex,
}: {
  score: number | null;
  breakdown: ReportTrustBreakdown | null;
  aiSource?: HazardReport["aiSource"];
  hasVertex?: boolean;
}) {
  const total = score ?? 0;
  const slices = [
    {
      key: "ID",
      value: breakdown?.identity ?? 0,
      cap: TRUST_CAPS.identity,
      brand: null as "gemini" | "vertex" | null,
    },
    {
      key: "Contact",
      value: breakdown?.contact ?? 0,
      cap: TRUST_CAPS.contact,
      brand: null as "gemini" | "vertex" | null,
    },
    {
      key: "Allow location · Mobile camera",
      value: breakdown?.capture ?? 0,
      cap: TRUST_CAPS.capture,
      brand: null as "gemini" | "vertex" | null,
    },
    {
      key: "Vertex",
      value: breakdown?.vertex ?? 0,
      cap: TRUST_CAPS.vertex,
      brand: (hasVertex ? "vertex" : null) as "gemini" | "vertex" | null,
    },
    {
      key: "Gemini",
      value: breakdown?.ai ?? 0,
      cap: TRUST_CAPS.ai,
      brand: (aiSource === "gemini" ? "gemini" : null) as
        | "gemini"
        | "vertex"
        | null,
    },
  ] as const;

  const tone =
    score == null
      ? "bg-[var(--border)]"
      : total >= 80
        ? "bg-[var(--success)]"
        : total >= 55
          ? "bg-[#2563eb]"
          : total >= 30
            ? "bg-[var(--warn)]"
            : "bg-[var(--danger)]";

  return (
    <div className="mt-3 border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            Trust meter
          </p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {score == null ? "Not scored yet" : trustLabel(total)}
          </p>
        </div>
        <p className="font-[family-name:var(--font-display)] text-2xl font-semibold tabular-nums tracking-wide">
          {score == null ? "—" : `${total}%`}
        </p>
      </div>

      <div
        className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--border)]/70"
        role="meter"
        aria-label="Trust score"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={score ?? 0}
      >
        <div
          className={cn("h-full rounded-full transition-[width]", tone)}
          style={{ width: `${Math.min(100, Math.max(0, total))}%` }}
        />
      </div>

      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {slices.map((s) => {
          const pct = s.cap > 0 ? Math.round((s.value / s.cap) * 100) : 0;
          return (
            <li key={s.key} className="min-w-0">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
                  {s.brand === "gemini" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/brands/gemini.png"
                      alt=""
                      title="Gemini"
                      className="h-3 w-auto shrink-0 opacity-80"
                    />
                  ) : null}
                  {s.brand === "vertex" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src="/brands/vertex-ai.svg"
                      alt=""
                      title="Vertex AI"
                      className="h-3 w-auto shrink-0 opacity-80"
                    />
                  ) : null}
                  {s.key}
                </span>
                <span className="font-mono tabular-nums text-[var(--muted)]">
                  {s.value}/{s.cap}
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--border)]/70">
                <div
                  className="h-full rounded-full bg-[var(--foreground)]/70"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
