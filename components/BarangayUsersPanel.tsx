"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node as FlowNode,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion } from "framer-motion";
import { MoreVertical } from "lucide-react";
import {
  officerScopeBarangay,
  subscribeBarangayUsers,
} from "@/lib/auth/accountValidation";
import { ensureKenHouseholdCitizens } from "@/lib/auth/ensureKenHouseholdCitizens";
import { ensureNangkaOfficers } from "@/lib/auth/ensureNangkaOfficers";
import {
  addExistingOfficerFromHousehold,
  fireOfficerByCaptain,
  hireOfficerByCaptain,
} from "@/lib/auth/officerEmployment";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  ensureCuratedHouseholds,
  subscribeHouseholds,
} from "@/lib/households/api";
import type { Household } from "@/lib/households/types";
import { STAFF_RANK_ORDER, type StaffRank } from "@/lib/staff/types";
import {
  hasCaptainRole,
  isAccountActive,
  isBarangayCaptain,
  isCitizen,
  isOfficer,
  type CitizenProfile,
  type OfficerProfile,
  type UserProfile,
} from "@/lib/auth/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function statusLabel(u: UserProfile): string {
  const s = u.accountStatus;
  if (s === "pending") return "Pending";
  if (s === "rejected") return "Rejected";
  if (s === "fired") return "Former";
  return "Active";
}

function statusTone(u: UserProfile): string {
  const s = u.accountStatus;
  if (s === "pending") return "text-[var(--warn)]";
  if (s === "rejected" || s === "fired") return "text-[var(--danger)]";
  return "text-[var(--accent)]";
}

type OfficerNodeData = {
  officer: OfficerProfile;
  tier: "apex" | "mid" | "base";
  canManage: boolean;
  captain: OfficerProfile | null;
  household: Household | null;
  onFired: (err: string | null) => void;
  onNotice: (msg: string | null) => void;
};

function OfficerCard({
  officer,
  tier,
  canManage,
  captain,
  household,
  onFired,
  onNotice,
}: OfficerNodeData) {
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmFire, setConfirmFire] = useState(false);
  const [reason, setReason] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  const showFire =
    canManage &&
    captain &&
    officer.accountStatus !== "fired" &&
    officer.uid !== captain.uid &&
    !hasCaptainRole(officer);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  async function onFire() {
    if (!captain) return;
    setBusy(true);
    onFired(null);
    try {
      await fireOfficerByCaptain(captain, officer, reason);
      setConfirmFire(false);
      setReason("");
      setMenuOpen(false);
    } catch (err) {
      onFired(err instanceof Error ? err.message : "Could not fire officer");
    } finally {
      setBusy(false);
    }
  }

  function onViewLocation() {
    setMenuOpen(false);
    const lat = household?.lat;
    const lng = household?.lng;
    if (lat == null || lng == null) {
      onNotice("No house location linked for this officer.");
      return;
    }
    onNotice(null);
    window.open(
      `https://www.google.com/maps?q=${lat},${lng}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <article
      className={cn(
        "relative flex min-w-0 flex-col border bg-[var(--surface-raised)] px-2.5 py-2.5 pr-7 text-center sm:px-3 sm:pr-8",
        tier === "apex" &&
          "w-[13.5rem] border-[var(--accent)] shadow-[0_0_0_1px_rgba(199, 41, 41,0.15)]",
        tier === "mid" && "w-[10.25rem] border-[var(--border)]",
        tier === "base" && "w-[9.5rem] border-[var(--border)] opacity-95",
      )}
    >
      <div
        ref={menuRef}
        className="nodrag nopan absolute top-1.5 right-1 z-20"
      >
        <button
          type="button"
          aria-label="Officer actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-7 w-7 items-center justify-center text-[var(--muted)] transition hover:bg-[var(--surface-panel)] hover:text-[var(--foreground)]"
          onClick={() => {
            setMenuOpen((v) => !v);
            setConfirmFire(false);
          }}
        >
          <MoreVertical className="h-4 w-4" strokeWidth={2} />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute top-full right-0 mt-0.5 min-w-[9.5rem] bg-[var(--surface)] py-1 text-left shadow-md ring-1 ring-[var(--border)]"
          >
            <button
              type="button"
              role="menuitem"
              className="block w-full px-3 py-1.5 text-left text-xs text-[var(--foreground)] hover:bg-[var(--surface-panel)]"
              onClick={onViewLocation}
            >
              View location
            </button>
            {showFire ? (
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-xs text-[var(--danger)] hover:bg-[var(--surface-panel)]"
                onClick={() => {
                  setConfirmFire(true);
                  setMenuOpen(false);
                }}
              >
                Fire
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span
          className={cn(
            "font-mono text-[9px] tracking-wider uppercase",
            statusTone(officer),
          )}
        >
          {statusLabel(officer)}
        </span>
        {hasCaptainRole(officer) ? (
          <span className="bg-[var(--accent)]/12 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-[var(--accent)] uppercase">
            Captain
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 line-clamp-2 font-medium text-[var(--foreground)]",
          tier === "apex" &&
            "font-[family-name:var(--font-display)] text-base tracking-wide",
          tier !== "apex" && "text-sm",
        )}
      >
        {officer.displayName || "—"}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[11px] text-[var(--muted)]">
        {officer.officerTitle || officer.orgName}
      </p>
      <p className="mt-1 truncate font-mono text-[9px] text-[var(--muted)]">
        {officer.email}
      </p>
      {officer.accountStatus === "fired" && officer.firedReason ? (
        <p className="mt-1 text-[10px] text-[var(--danger)]">
          {officer.firedReason}
        </p>
      ) : null}
      {officer.employmentHistory && officer.employmentHistory.length > 0 ? (
        <details className="mt-1 text-left">
          <summary className="cursor-pointer font-mono text-[9px] tracking-wider text-[var(--muted)] uppercase">
            History
          </summary>
          <ul className="mt-1 space-y-0.5 text-[10px] text-[var(--muted)]">
            {[...officer.employmentHistory]
              .sort((a, b) => b.at.localeCompare(a.at))
              .map((ev, i) => (
                <li key={`${ev.at}-${i}`}>
                  {ev.action === "hired" ? "Hired" : "Fired"}
                  {ev.title ? ` · ${ev.title}` : ""}
                  {ev.byName ? ` · ${ev.byName}` : ""}
                </li>
              ))}
          </ul>
        </details>
      ) : null}
      {confirmFire && showFire ? (
        <div className="nodrag nopan mt-2 space-y-1.5 pt-2 text-left">
          <p className="text-[10px] text-[var(--muted)]">
            Remove from active staff? History is kept.
          </p>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason (optional)"
            className="w-full bg-[var(--input)] px-2 py-1 text-xs outline-none ring-1 ring-[var(--border)] focus:ring-[var(--accent)]"
          />
          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void onFire()}
            >
              {busy ? "…" : "Confirm fire"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirmFire(false);
                setReason("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function pyramidBand(o: OfficerProfile): number {
  if (hasCaptainRole(o) || o.staffRank === "captain") return 0;
  const rank = (o.staffRank ?? "") as StaffRank;
  const order = STAFF_RANK_ORDER[rank];
  if (order != null) {
    if (order <= 3) return 1; // secretary / treasurer / kagawad / sk
    if (order === 4) return 2; // mdrrmo
    if (order === 5) return 3; // bhw / tanod chief
    return 4; // tanod / staff / volunteer
  }
  return 2;
}

/** Collapse twin officer docs (same email / staffId). */
function dedupeOfficers(list: OfficerProfile[]): OfficerProfile[] {
  const byKey = new Map<string, OfficerProfile>();
  for (const o of list) {
    const email = o.email.trim().toLowerCase();
    const key =
      (o.staffId && `staff:${o.staffId}`) ||
      (email && `email:${email}`) ||
      `uid:${o.uid}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, o);
      continue;
    }
    const score = (x: OfficerProfile) =>
      (x.accountStatus === "active" || x.accountStatus == null ? 10 : 0) +
      (x.officerTitle ? 2 : 0) +
      (x.employmentHistory?.length ?? 0);
    if (score(o) > score(prev)) byKey.set(key, o);
  }
  return [...byKey.values()];
}

function OfficerFlowNode({ data }: NodeProps<FlowNode<OfficerNodeData>>) {
  return (
    <>
      <Handle type="target" position={Position.Top} />
      <OfficerCard {...data} />
      <Handle type="source" position={Position.Bottom} />
    </>
  );
}

const officerNodeTypes = { officer: OfficerFlowNode };

const NODE_W = { apex: 216, mid: 164, base: 152 } as const;
const NODE_H = 128;
const GAP_X = 20;
const GAP_Y = 64;
const WRAP_GAP_Y = 24;
const MAX_COLS = { apex: 1, mid: 4, base: 5 } as const;

function chunkRows<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out.length ? out : [[]];
}

function OfficersFlowCanvas({
  nodes,
  edges,
  height,
}: {
  nodes: FlowNode<OfficerNodeData>[];
  edges: Edge[];
  height: number;
}) {
  const fitted = useRef(false);

  return (
    <div
      className="officer-hierarchy-flow w-full min-w-0 overflow-hidden rounded-sm"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={officerNodeTypes}
        onInit={(inst) => {
          if (fitted.current) return;
          fitted.current = true;
          window.requestAnimationFrame(() => {
            inst.fitView({ padding: 0.14, minZoom: 0.35, maxZoom: 1 });
          });
        }}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.35}
        maxZoom={1}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          style: { stroke: "#c72929", strokeWidth: 1.75 },
        }}
      />
    </div>
  );
}

function OfficersPyramid({
  barangay,
  officers,
  canManage,
  captain,
  householdByOfficerUid,
  onFired,
  onNotice,
  showFormer,
  onToggleFormer,
}: {
  barangay: string;
  officers: OfficerProfile[];
  canManage: boolean;
  captain: OfficerProfile | null;
  householdByOfficerUid: Map<string, Household>;
  onFired: (err: string | null) => void;
  onNotice: (msg: string | null) => void;
  showFormer: boolean;
  onToggleFormer: (v: boolean) => void;
}) {
  const onFiredRef = useRef(onFired);
  const onNoticeRef = useRef(onNotice);
  const hhRef = useRef(householdByOfficerUid);
  onFiredRef.current = onFired;
  onNoticeRef.current = onNotice;
  hhRef.current = householdByOfficerUid;

  const bands = useMemo(() => {
    const unique = dedupeOfficers(officers);
    const active = unique.filter(
      (o) => o.accountStatus == null || o.accountStatus === "active",
    );
    const other = unique.filter(
      (o) =>
        o.accountStatus === "pending" ||
        o.accountStatus === "rejected" ||
        o.accountStatus === "fired",
    );
    const byBand: OfficerProfile[][] = [[], [], [], [], []];
    for (const o of active) {
      byBand[pyramidBand(o)]!.push(o);
    }
    for (const band of byBand) {
      band.sort((a, b) => {
        const ra = STAFF_RANK_ORDER[(a.staffRank ?? "") as StaffRank] ?? 99;
        const rb = STAFF_RANK_ORDER[(b.staffRank ?? "") as StaffRank] ?? 99;
        if (ra !== rb) return ra - rb;
        return (a.displayName || "").localeCompare(b.displayName || "");
      });
    }
    return { byBand, other };
  }, [officers]);

  const visibleOther = showFormer
    ? bands.other
    : bands.other.filter((o) => o.accountStatus === "pending");

  const structureKey = useMemo(() => {
    const parts: string[] = [];
    for (const band of bands.byBand) {
      for (const o of band) {
        const hh = householdByOfficerUid.get(o.uid);
        parts.push(
          `${o.uid}|${o.accountStatus ?? "active"}|${o.displayName}|${o.officerTitle ?? ""}|${o.staffRank ?? ""}|hh:${hh?.id ?? ""}`,
        );
      }
    }
    for (const o of visibleOther) {
      parts.push(`o:${o.uid}|${o.accountStatus}`);
    }
    return `${parts.join(";")}|c:${canManage}|cap:${captain?.uid ?? ""}`;
  }, [
    bands.byBand,
    visibleOther,
    canManage,
    captain?.uid,
    householdByOfficerUid,
  ]);

  const graph = useMemo(() => {
    const tiers = (
      [
        { rows: bands.byBand[0] ?? [], tier: "apex" as const, linkUp: false },
        { rows: bands.byBand[1] ?? [], tier: "mid" as const, linkUp: true },
        { rows: bands.byBand[2] ?? [], tier: "mid" as const, linkUp: true },
        { rows: bands.byBand[3] ?? [], tier: "mid" as const, linkUp: true },
        { rows: bands.byBand[4] ?? [], tier: "base" as const, linkUp: true },
        { rows: visibleOther, tier: "base" as const, linkUp: false },
      ] as const
    ).filter((t) => t.rows.length > 0);

    const nodes: FlowNode<OfficerNodeData>[] = [];
    const edges: Edge[] = [];
    const bandIds: string[][] = [];
    let y = 0;
    let wrapRows = 0;

    for (let ti = 0; ti < tiers.length; ti++) {
      const t = tiers[ti]!;
      const w = NODE_W[t.tier];
      const strips = chunkRows(t.rows, MAX_COLS[t.tier]);
      const ids: string[] = [];
      const bandTop = y;

      strips.forEach((strip, si) => {
        const rowWidth =
          strip.length * w + Math.max(0, strip.length - 1) * GAP_X;
        const startX = -rowWidth / 2;
        const rowY = bandTop + si * (NODE_H + WRAP_GAP_Y);
        strip.forEach((o, i) => {
          ids.push(o.uid);
          nodes.push({
            id: o.uid,
            type: "officer",
            position: { x: startX + i * (w + GAP_X), y: rowY },
            data: {
              officer: o,
              tier: t.tier,
              canManage,
              captain,
              household: hhRef.current.get(o.uid) ?? null,
              onFired: (err) => onFiredRef.current(err),
              onNotice: (msg) => onNoticeRef.current(msg),
            },
            draggable: false,
            selectable: false,
            connectable: false,
          });
        });
      });

      bandIds.push(ids);
      wrapRows += strips.length;
      y =
        bandTop +
        strips.length * NODE_H +
        Math.max(0, strips.length - 1) * WRAP_GAP_Y +
        GAP_Y;

      if (t.linkUp && ti > 0) {
        const parents = bandIds[ti - 1] ?? [];
        if (parents.length) {
          ids.forEach((childId, i) => {
            const parentId =
              parents[
                Math.min(
                  Math.floor((i / ids.length) * parents.length),
                  parents.length - 1,
                )
              ]!;
            edges.push({
              id: `${parentId}->${childId}`,
              source: parentId,
              target: childId,
              type: "smoothstep",
              animated: ti === 1,
              focusable: false,
              interactionWidth: 0,
              style: { stroke: "#c72929", strokeWidth: 1.75 },
            });
          });
        }
      }
    }

    const height = Math.min(
      720,
      Math.max(
        360,
        wrapRows * NODE_H +
          Math.max(0, wrapRows - tiers.length) * WRAP_GAP_Y +
          Math.max(0, tiers.length - 1) * GAP_Y +
          80,
      ),
    );
    return { nodes, edges, height };
    // structureKey encodes officer display fields; callbacks via refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional stable graph
  }, [structureKey]);

  if (officers.length === 0) {
    return (
      <section className="bg-[var(--surface-panel)]/30 px-4 py-10 text-center">
        <p className="font-medium">No officers yet</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add staff or wait for peer-approved registrations.
        </p>
      </section>
    );
  }

  return (
    <section className="relative w-full min-w-0 overflow-hidden py-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(199, 41, 41,0.12), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="relative mb-3 flex flex-wrap items-end justify-between gap-2 px-2">
        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Brgy. {barangay}
          </p>
          <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
            Officers
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Punong Barangay → council → MDRRMO → tanods
          </p>
        </div>
        <label className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
          <input
            type="checkbox"
            checked={showFormer}
            onChange={(e) => onToggleFormer(e.target.checked)}
            className="accent-[var(--accent)]"
          />
          Show former / pending
        </label>
      </div>

      <motion.div
        className="relative"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <ReactFlowProvider>
          <OfficersFlowCanvas
            key={structureKey}
            nodes={graph.nodes}
            edges={graph.edges}
            height={graph.height}
          />
        </ReactFlowProvider>
      </motion.div>
    </section>
  );
}

function CitizensTable({ citizens }: { citizens: CitizenProfile[] }) {
  return (
    <section className="border border-[var(--border)] bg-[var(--surface-raised)]">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[var(--accent)] uppercase">
              Residents
            </p>
            <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-wide">
              Citizens
            </h3>
            <p className="text-xs text-[var(--muted)]">
              Active registered app users · pending stay in validation above
            </p>
          </div>
          <p className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
            {citizens.length}{" "}
            {citizens.length === 1 ? "account" : "accounts"}
          </p>
        </div>
      </div>

      {citizens.length === 0 ? (
        <p className="px-4 py-8 text-sm text-[var(--muted)]">
          No citizen accounts in this barangay yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-panel)] font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              <tr>
                <th className="px-3 py-2.5 font-medium">Name</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Phone</th>
                <th className="px-3 py-2.5 font-medium">Purok</th>
                <th className="px-3 py-2.5 font-medium">Household</th>
              </tr>
            </thead>
            <tbody>
              {citizens.map((c) => (
                <tr
                  key={c.uid}
                  className="border-b border-[var(--border)]/70 last:border-0"
                >
                  <td className="px-3 py-2.5 align-top font-medium">
                    {c.displayName || "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top break-all font-mono text-xs text-[var(--muted)]">
                    {c.email}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-xs text-[var(--muted)]">
                    {c.phone || "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top text-[var(--muted)]">
                    {c.purok || "—"}
                  </td>
                  <td className="px-3 py-2.5 align-top font-mono text-[10px] text-[var(--muted)]">
                    {c.householdId ? "Linked" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AddExistingOfficerModal({
  captain,
  open,
  onClose,
  onAdded,
  officerEmails,
  rosterOfficerUids,
}: {
  captain: OfficerProfile;
  open: boolean;
  onClose: () => void;
  onAdded: (msg: string) => void;
  officerEmails: Set<string>;
  /** Captain + MDRRMO roster owners so the full house list is available. */
  rosterOfficerUids: string[];
}) {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loadingHh, setLoadingHh] = useState(true);
  const [householdId, setHouseholdId] = useState("");
  const [title, setTitle] = useState("Barangay Staff");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoadingHh(true);
    const uids = rosterOfficerUids.length > 0 ? rosterOfficerUids : [captain.uid];
    const byId = new Map<string, Household>();
    const unsubs = uids.map((uid) =>
      subscribeHouseholds(
        uid,
        (rows) => {
          for (const h of rows) byId.set(h.id, h);
          setHouseholds([...byId.values()]);
          setLoadingHh(false);
        },
        () => setLoadingHh(false),
      ),
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [open, captain.uid, rosterOfficerUids]);

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return households
      .filter((h) => {
        const email = h.email.trim().toLowerCase();
        if (!email) return false;
        // Prefer house owners not already active officers
        if (officerEmails.has(email) && (h.linkedOfficerUids?.length ?? 0) > 0) {
          return false;
        }
        if (!q) return true;
        return [h.ownerName, h.email, h.phone, h.purok, h.address]
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .sort((a, b) => a.ownerName.localeCompare(b.ownerName))
      .slice(0, 80);
  }, [households, officerEmails, search]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const hh = households.find((h) => h.id === householdId);
    if (!hh) {
      setError("Pick a house owner from the list.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addExistingOfficerFromHousehold(captain, {
        household: hh,
        title,
        password,
      });
      onAdded(`Added ${hh.ownerName} as officer · ${hh.email}`);
      setHouseholdId("");
      setTitle("Barangay Staff");
      setPassword("demo1234");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add officer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="add-existing-officer-title"
        className="w-full max-w-lg border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg"
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            Existing house owner
          </p>
          <h3
            id="add-existing-officer-title"
            className="font-[family-name:var(--font-display)] text-lg font-semibold"
          >
            Add existing officer
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Pick someone already on the house-owner roster — creates / links
            their officer login.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 px-4 py-4">
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Search roster
            </span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, purok…"
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              House owner
            </span>
            {loadingHh ? (
              <p className="mt-2 text-sm text-[var(--muted)]">Loading roster…</p>
            ) : candidates.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--muted)]">
                No eligible house owners with email found.
              </p>
            ) : (
              <select
                required
                value={householdId}
                onChange={(e) => setHouseholdId(e.target.value)}
                className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="">Select…</option>
                {candidates.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.ownerName} · {h.email}
                    {h.purok ? ` · ${h.purok}` : ""}
                  </option>
                ))}
              </select>
            )}
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Officer title
            </span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tanod, Kagawad, MDRRMO Focal…"
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Login password
            </span>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={busy || !householdId || loadingHh}
            >
              {busy ? "Adding…" : "Add as officer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddNewOfficerModal({
  captain,
  open,
  onClose,
  onAdded,
}: {
  captain: OfficerProfile;
  open: boolean;
  onClose: () => void;
  onAdded: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("Barangay Staff");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("demo1234");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await hireOfficerByCaptain(captain, {
        displayName,
        title,
        email,
        password,
      });
      onAdded(`Added ${displayName.trim()} · ${email.trim().toLowerCase()}`);
      setDisplayName("");
      setTitle("Barangay Staff");
      setEmail("");
      setPassword("demo1234");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add officer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-labelledby="add-new-officer-title"
        className="w-full max-w-md border border-[var(--border)] bg-[var(--surface-raised)] shadow-lg"
      >
        <div className="border-b border-[var(--border)] px-4 py-3">
          <p className="font-mono text-[9px] tracking-[0.2em] text-[var(--accent)] uppercase">
            New officer
          </p>
          <h3
            id="add-new-officer-title"
            className="font-[family-name:var(--font-display)] text-lg font-semibold"
          >
            Add new officer
          </h3>
          <p className="text-xs text-[var(--muted)]">
            Create a new staff login for Brgy. {officerScopeBarangay(captain)}.
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-3 px-4 py-4">
          {error ? (
            <p className="text-sm text-[var(--danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Full name
            </span>
            <input
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Title / role
            </span>
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tanod, Kagawad, MDRRMO Focal…"
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Email (login)
            </span>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[10px] tracking-wider text-[var(--muted)] uppercase">
              Temporary password
            </span>
            <input
              required
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Adding…" : "Add new officer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function BarangayUsersPanel() {
  const { profile } = useAuth();
  const barangay = isOfficer(profile) ? officerScopeBarangay(profile) : "";
  const areaId = isOfficer(profile)
    ? profile.areaId ?? profile.activeBarangayId
    : null;
  const captain = isBarangayCaptain(profile) ? profile : null;

  const [rows, setRows] = useState<UserProfile[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showFormer, setShowFormer] = useState(true);
  const [addExistingOpen, setAddExistingOpen] = useState(false);
  const [addNewOpen, setAddNewOpen] = useState(false);
  const kenSeeded = useRef(false);

  useEffect(() => {
    if (!isOfficer(profile) || !barangay) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return subscribeBarangayUsers(
      barangay,
      (next) => {
        setRows(next);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      areaId,
    );
  }, [profile, barangay, areaId]);

  const seedStaff = useCallback(async () => {
    if (!isOfficer(profile) || !isAccountActive(profile)) return;
    setError(null);
    const org = profile.orgName || "Brgy. Nangka MDRRMO";
    try {
      await ensureCuratedHouseholds(profile.uid, org, []);
      const off = await ensureNangkaOfficers(profile.uid, org);
      const cit = await ensureKenHouseholdCitizens();
      const parts: string[] = [];
      if (off.officers > 0) {
        parts.push(
          `${off.officers} barangay officers · ${off.households} house links`,
        );
      }
      if (cit.linked > 0) {
        parts.push(`${cit.linked} citizen links (Ken · Carl · Pat)`);
      }
      if (off.errors.length > 0) {
        setError(
          `Staff seed partial: ${off.errors.slice(0, 2).join(" · ")}${
            off.errors.length > 2 ? "…" : ""
          }`,
        );
      }
      if (parts.length) setMsg(parts.join(" · "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Staff seed failed");
      throw err;
    }
  }, [profile]);

  // Seed Nangka staff officers + house links, then Ken/Jeanilou citizens.
  useEffect(() => {
    if (
      !isOfficer(profile) ||
      !isAccountActive(profile) ||
      kenSeeded.current ||
      loading
    ) {
      return;
    }
    kenSeeded.current = true;
    void seedStaff().catch(() => {
      kenSeeded.current = false;
    });
  }, [profile, loading, seedStaff]);

  const officers = useMemo(
    () =>
      rows.filter((u): u is OfficerProfile => isOfficer(u)),
    [rows],
  );

  const citizens = useMemo(
    () =>
      rows.filter(
        (u): u is CitizenProfile => isCitizen(u) && isAccountActive(u),
      ),
    [rows],
  );

  const officerEmails = useMemo(() => {
    const set = new Set<string>();
    for (const o of officers) {
      if (o.accountStatus === "fired") continue;
      const e = o.email.trim().toLowerCase();
      if (e) set.add(e);
    }
    return set;
  }, [officers]);

  const rosterOfficerUids = useMemo(() => {
    const uids = new Set<string>();
    if (isOfficer(profile)) uids.add(profile.uid);
    for (const o of officers) {
      if (o.accountStatus === "fired") continue;
      if (
        o.staffId === "mdrrmo" ||
        o.email.includes("officer@nangka") ||
        hasCaptainRole(o)
      ) {
        uids.add(o.uid);
      }
    }
    return [...uids];
  }, [profile, officers]);

  useEffect(() => {
    if (!isOfficer(profile)) {
      setHouseholds([]);
      return;
    }
    const uids =
      rosterOfficerUids.length > 0 ? rosterOfficerUids : [profile.uid];
    const byId = new Map<string, Household>();
    const unsubs = uids.map((uid) =>
      subscribeHouseholds(uid, (next) => {
        for (const h of next) byId.set(h.id, h);
        setHouseholds([...byId.values()]);
      }),
    );
    return () => {
      for (const u of unsubs) u();
    };
  }, [profile, rosterOfficerUids]);

  const householdByOfficerUid = useMemo(() => {
    const map = new Map<string, Household>();
    for (const h of households) {
      for (const uid of h.linkedOfficerUids ?? []) {
        if (!map.has(uid)) map.set(uid, h);
      }
      // Match by email when link array is empty but house is the officer's home.
      const email = h.email.trim().toLowerCase();
      if (email) {
        for (const o of officers) {
          if (o.email.trim().toLowerCase() === email && !map.has(o.uid)) {
            map.set(o.uid, h);
          }
        }
      }
    }
    return map;
  }, [households, officers]);

  if (!isOfficer(profile)) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Sign in as a barangay officer to view users.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
            Users
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-xs text-[var(--muted)]">
            {loading
              ? "…"
              : `${officers.length} officer${officers.length === 1 ? "" : "s"} · ${citizens.length} citizen${citizens.length === 1 ? "" : "s"}`}
          </p>
          {captain ? (
            <>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAddExistingOpen(true)}
              >
                Add existing officer
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setAddNewOpen(true)}
              >
                Add new officer
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="text-sm text-[var(--accent)]" role="status">
          {msg}
        </p>
      ) : null}

      {loading ? (
        <p className="font-mono text-sm text-[var(--muted)]">Loading users…</p>
      ) : (
        <div className="space-y-6">
          <OfficersPyramid
            barangay={barangay}
            officers={officers}
            canManage={Boolean(captain)}
            captain={captain}
            householdByOfficerUid={householdByOfficerUid}
            showFormer={showFormer}
            onToggleFormer={setShowFormer}
            onFired={(err) => {
              setError(err);
              if (!err) setMsg("Officer removed — history kept.");
            }}
            onNotice={(m) => {
              setMsg(m);
              if (m) setError(null);
            }}
          />
          <CitizensTable citizens={citizens} />
        </div>
      )}

      {!isAccountActive(profile) ? (
        <p className="text-xs text-[var(--muted)]">
          Your account is not active yet — lists still show your barangay scope
          once approved.
        </p>
      ) : null}

      {captain ? (
        <>
          <AddExistingOfficerModal
            captain={captain}
            open={addExistingOpen}
            officerEmails={officerEmails}
            rosterOfficerUids={rosterOfficerUids}
            onClose={() => setAddExistingOpen(false)}
            onAdded={(m) => {
              setMsg(m);
              setError(null);
            }}
          />
          <AddNewOfficerModal
            captain={captain}
            open={addNewOpen}
            onClose={() => setAddNewOpen(false)}
            onAdded={(m) => {
              setMsg(m);
              setError(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
