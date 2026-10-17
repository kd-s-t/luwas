"use client";

import { useMemo } from "react";
import Image from "next/image";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  FlowCostsBelow,
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const BLUE = "#2f5f9e";
const RED = "#c72929";
const GREEN = "#16794c";
const AMBER = "#b45309";
const SITE_W = 1860;
const SITE_H = 540;

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    logo?: string;
    logos?: string[];
    costs?: string[];
    note?: string;
    inLeft?: boolean;
    inTop?: boolean;
    inBot?: boolean;
    inFromTop?: boolean;
    outRight?: boolean;
    outTop?: boolean;
    outBot?: boolean;
    outDown?: boolean;
  };
  const logos = d.logos?.length ? d.logos : d.logo ? [d.logo] : [];
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 156 }}>
      {d.note ? (
        <p className="absolute -top-6 left-1/2 w-max -translate-x-1/2 font-mono text-[10px] text-[var(--muted)]">
          {d.note}
        </p>
      ) : null}
      {d.inFromTop ? (
        <Handle
          type="target"
          position={Position.Top}
          id="in-from-top"
          className="!size-2 !border-0"
          style={{ background: BLUE }}
        />
      ) : null}
      {d.inLeft ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !border-0"
          style={{ background: BLUE }}
        />
      ) : null}
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-top"
          style={{ top: "30%", background: BLUE }}
          className="!size-2 !border-0"
        />
      ) : null}
      {d.inBot ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-bot"
          style={{ top: "70%", background: BLUE }}
          className="!size-2 !border-0"
        />
      ) : null}
      {logos.length > 0 ? (
        <div className="flex items-center justify-center gap-1.5">
          {logos.map((src) => (
            <Image
              key={src}
              src={src}
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
          ))}
        </div>
      ) : null}
      <p className={flowLabelClass}>{d.label}</p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      <FlowCostsBelow costs={d.costs} />
      {d.outRight ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="!size-2 !border-0"
          style={{ background: BLUE }}
        />
      ) : null}
      {d.outTop ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-top"
          style={{ top: "30%", background: BLUE }}
          className="!size-2 !border-0"
        />
      ) : null}
      {d.outBot ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-bot"
          style={{ top: "70%", background: BLUE }}
          className="!size-2 !border-0"
        />
      ) : null}
      {d.outDown ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="down"
          className="!size-2 !border-0"
          style={{ background: BLUE }}
        />
      ) : null}
    </div>
  );
}

function CitizenNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 130 }}>
      <Image
        src="/brands/citizens.png"
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>Citizen</p>
      <p className={flowMetaClass}>Report incident</p>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-2 !border-0"
        style={{ background: RED }}
      />
    </div>
  );
}

function OfficerNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 130 }}>
      <Image
        src="/brands/officer.png"
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>Officer</p>
      <p className={flowMetaClass}>Open resources</p>
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-2 !border-0"
        style={{ background: BLUE }}
      />
    </div>
  );
}

function ReportNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 150 }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-2 !border-0"
        style={{ background: RED }}
      />
      <Image
        src="/brands/firebase.png"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
      <p className={flowLabelClass}>Incident reports</p>
      <p className={flowMetaClass}>No drinking water</p>
      <Handle
        type="source"
        position={Position.Bottom}
        id="down"
        className="!size-2 !border-0"
        style={{ background: RED }}
      />
    </div>
  );
}

function OutcomeNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    tone: "ok" | "warn";
    inTop?: boolean;
    inLeft?: boolean;
  };
  const color = d.tone === "ok" ? GREEN : AMBER;
  return (
    <div
      className="relative rounded-[8px] border bg-white px-3 py-2.5 text-center"
      style={{ width: 148, borderColor: color }}
    >
      {d.inLeft ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Top}
          id="in-top"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      <p className="text-sm font-semibold" style={{ color }}>
        {d.label}
      </p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
    </div>
  );
}

function SiteGroupNode(_props: NodeProps) {
  return (
    <div className="relative h-full w-full rounded-[8px] border border-[var(--border)] bg-white/60">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-[8px] bg-[#c72929]" />
      <Image
        src="/brands/firebase.png"
        alt="Firebase"
        width={24}
        height={24}
        className="absolute top-3 right-10 size-6 object-contain"
      />
      <Image
        src="/brands/cloud-run.png"
        alt="Cloud Run"
        width={24}
        height={24}
        className="absolute top-3 right-3 size-6 object-contain"
      />
      <p className="absolute top-3 left-3 font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">
        Ugnaiph.com
      </p>
    </div>
  );
}

const nodeTypes = {
  citizen: CitizenNode,
  officer: OfficerNode,
  report: ReportNode,
  step: StepNode,
  outcome: OutcomeNode,
  siteGroup: SiteGroupNode,
};

function ResourcesFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
      labelStyle: { fill: "#5c6570", fontSize: 11 },
    };
    const marker = {
      type: MarkerType.ArrowClosed,
      color: BLUE,
    } as const;
    const stroke = { stroke: BLUE, strokeWidth: 1.75 };
    const redMarker = {
      type: MarkerType.ArrowClosed,
      color: RED,
    } as const;
    const redStroke = { stroke: RED, strokeWidth: 1.75 };
    const warnStroke = { stroke: AMBER, strokeWidth: 1.75 };
    const warnMarker = {
      type: MarkerType.ArrowClosed,
      color: AMBER,
    } as const;
    const okStroke = { stroke: GREEN, strokeWidth: 1.75 };
    const okMarker = {
      type: MarkerType.ArrowClosed,
      color: GREEN,
    } as const;

    const n: Node[] = [
      {
        id: "citizen",
        type: "citizen",
        position: { x: -59.18, y: -32.34 },
        data: {},
      },
      {
        id: "officer",
        type: "officer",
        position: { x: -53.12, y: 232.13 },
        data: {},
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 189.1, y: -99.1 },
        data: {},
        style: { width: SITE_W, height: SITE_H },
        width: SITE_W,
        height: SITE_H,
      },
      {
        id: "report",
        type: "report",
        parentId: "site",
        extent: "parent",
        position: { x: 40.48, y: 60.48 },
        data: {},
      },
      {
        id: "board",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 32.9, y: 340.66 },
        data: {
          label: "Resources board",
          lines: ["/admin/resources", "shortages · approvals"],
          inLeft: true,
          inFromTop: true,
          outRight: true,
        },
      },
      {
        id: "inventory",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 235.75, y: 102.13 },
        data: {
          label: "Inventory",
          lines: ["warehouse L available", "/admin/inventory"],
          outRight: true,
        },
      },
      {
        id: "desk",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 443.03, y: 269.73 },
        data: {
          label: "Shortage desk",
          note: "RS-001",
          lines: ["communities table", "gap vs stock · map"],
          inLeft: true,
          inTop: true,
          outRight: true,
          outDown: true,
        },
      },
      {
        id: "firestore",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 434.94, y: 403.16 },
        data: {
          label: "Firestore",
          logo: "/brands/firestore.png",
          lines: ["resources_shortages", "resources_suggestions"],
          inFromTop: true,
        },
      },
      {
        id: "gemini",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 760, y: 180 },
        data: {
          label: "Gemini options",
          logo: "/brands/gemini.png",
          lines: ["/api/ai/allocation-options"],
          costs: ["~$0.001 / draft", "cached on RS doc"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "compare",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1040, y: 38 },
        data: {
          label: "1 · Compare",
          lines: ["feasible · even · need", "officer picks option"],
          inLeft: true,
          outDown: true,
        },
      },
      {
        id: "review",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1037, y: 165 },
        data: {
          label: "2 · Review & approve",
          logo: "/brands/officer.png",
          lines: ["reserve plan", "no silent reassign"],
          inFromTop: true,
          outDown: true,
        },
      },
      {
        id: "track",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1040, y: 348 },
        data: {
          label: "3 · Track assistance",
          lines: ["per-community lines", "transport checks"],
          inFromTop: true,
          outTop: true,
          outBot: true,
        },
      },
      {
        id: "delivered",
        type: "outcome",
        parentId: "site",
        extent: "parent",
        position: { x: 1400, y: 149 },
        data: {
          label: "Delivered",
          tone: "ok",
          lines: ["evidence · done"],
          inLeft: true,
        },
      },
      {
        id: "transport",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1404, y: 341 },
        data: {
          label: "Resolve transport",
          lines: ["vehicles · partners", "Find assistance"],
          logos: [
            "/brands/philippine-red-cross.png",
            "/brands/dswd.png",
          ],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "commit",
        type: "outcome",
        parentId: "site",
        extent: "parent",
        position: { x: 1648, y: 371 },
        data: {
          label: "Partner commit",
          tone: "warn",
          lines: ["then back to track"],
          inLeft: true,
        },
      },
    ];

    const e: Edge[] = [
      {
        id: "e-citizen",
        source: "citizen",
        sourceHandle: "out",
        target: "report",
        targetHandle: "in",
        label: "report incident",
        markerEnd: redMarker,
        style: redStroke,
        ...labelBg,
      },
      {
        id: "e-officer",
        source: "officer",
        sourceHandle: "out",
        target: "board",
        targetHandle: "in",
        label: "resources board",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-report",
        source: "report",
        sourceHandle: "down",
        target: "board",
        targetHandle: "in-from-top",
        label: "supply need",
        markerEnd: redMarker,
        style: redStroke,
        ...labelBg,
      },
      {
        id: "e-board",
        source: "board",
        sourceHandle: "out",
        target: "desk",
        targetHandle: "in",
        label: "open RS",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-inventory",
        source: "inventory",
        sourceHandle: "out",
        target: "desk",
        targetHandle: "in-top",
        label: "available L",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-persist",
        source: "desk",
        sourceHandle: "down",
        target: "firestore",
        targetHandle: "in-from-top",
        label: "upsert",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-gemini",
        source: "desk",
        sourceHandle: "out",
        target: "gemini",
        targetHandle: "in",
        label: "communities JSON",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-compare",
        source: "gemini",
        sourceHandle: "out",
        target: "compare",
        targetHandle: "in",
        label: "3 drafts",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-review",
        source: "compare",
        sourceHandle: "down",
        target: "review",
        targetHandle: "in-from-top",
        label: "selected option",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-track",
        source: "review",
        sourceHandle: "down",
        target: "track",
        targetHandle: "in-from-top",
        label: "approved",
        markerEnd: marker,
        style: stroke,
        ...labelBg,
      },
      {
        id: "e-delivered",
        source: "track",
        sourceHandle: "out-top",
        target: "delivered",
        targetHandle: "in",
        label: "ready",
        markerEnd: okMarker,
        style: okStroke,
        ...labelBg,
      },
      {
        id: "e-transport",
        source: "track",
        sourceHandle: "out-bot",
        target: "transport",
        targetHandle: "in",
        label: "no transport",
        markerEnd: warnMarker,
        style: warnStroke,
        ...labelBg,
      },
      {
        id: "e-commit",
        source: "transport",
        sourceHandle: "out",
        target: "commit",
        targetHandle: "in",
        markerEnd: warnMarker,
        style: warnStroke,
      },
    ];

    return { defaultNodes: n, defaultEdges: e };
  }, []);

  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onMoveEnd,
    onReconnect,
    resetLayout,
    hasSavedLayout,
    defaultViewport,
    fitView,
    hydrated,
    canvasKey,
  } = useFlowLayout("resources-v5", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="resources-v5"
          nodes={nodes}
          edges={edges}
        />
        {hasSavedLayout ? (
          <button
            type="button"
            onClick={resetLayout}
            className="rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
          >
            Reset layout
          </button>
        ) : null}
      </div>
      {hydrated ? (
        <ReactFlow
          key={canvasKey}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onMoveEnd={onMoveEnd}
          onReconnect={onReconnect}
          nodeTypes={nodeTypes}
          defaultViewport={defaultViewport}
          fitView={fitView}
          edgesReconnectable
          reconnectRadius={28}
          fitViewOptions={{ padding: 0.14 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          minZoom={0.3}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: "smoothstep" }}
        >
          <Background gap={18} size={1} color="#d5dae2" />
          <Controls showInteractive={false} />
        </ReactFlow>
      ) : null}
    </div>
  );
}

export function ResourcesFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Resources Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Two entries: citizen report incident, or officer opens Resources
          board → shortage desk → Gemini drafts → compare · review · track.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <ResourcesFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
