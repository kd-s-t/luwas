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
  FlowMark,
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
  isFlowCostLine,
} from "@/components/flow/FlowMark";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const RED = "#c72929";
const GREEN = "#16794c";

function UserNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 140 }}>
      <Image
        src="/brands/citizens.png"
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>Non Register or Registered user</p>
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

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    logo?: string;
    inLeft?: boolean;
    inBottom?: boolean;
    outRight?: boolean;
    outBottom?: boolean;
  };
  const meta = (d.lines ?? []).filter((l) => !isFlowCostLine(l));
  const costs = (d.lines ?? []).filter(isFlowCostLine);
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 140 }}>
      {d.inLeft !== false ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !border-0"
          style={{ background: RED }}
        />
      ) : null}
      {d.inBottom ? (
        <Handle
          type="target"
          position={Position.Bottom}
          id="in-bottom"
          className="!size-2 !border-0"
          style={{ background: GREEN }}
        />
      ) : null}
      {d.logo ? (
        <Image
          src={d.logo}
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
        />
      ) : (
        <FlowMark size={24} />
      )}
      <p className={flowLabelClass}>{d.label}</p>
      {meta.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      <FlowCostsBelow costs={costs} />
      {d.outRight !== false ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="!size-2 !border-0"
          style={{ background: RED }}
        />
      ) : null}
      {d.outBottom ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="down"
          className="!size-2 !border-0"
          style={{ background: RED }}
        />
      ) : null}
    </div>
  );
}

function StatusNode({ data }: NodeProps) {
  const d = data as { label: string; tone: "ok" | "bad" };
  const color = d.tone === "ok" ? GREEN : RED;
  const isOk = d.tone === "ok";
  return (
    <div
      className="relative rounded-[8px] border bg-white px-3 py-2 text-center text-sm font-semibold"
      style={{ color, borderColor: color }}
    >
      {isOk ? (
        <Handle
          type="source"
          position={Position.Top}
          id="up"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : (
        <Handle
          type="target"
          position={Position.Top}
          id="in-top"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      )}
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-2 !border-0"
        style={{ background: color }}
      />
      {d.label}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-2 !border-0"
        style={{ background: color }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="down"
        className="!size-2 !border-0"
        style={{ background: color }}
      />
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
        className="absolute top-3 right-3 size-6 object-contain"
      />
      <p className="absolute top-3 left-3 font-mono text-[11px] tracking-wider text-[var(--muted)] uppercase">
        Ugnaiph.com
      </p>
    </div>
  );
}

const nodeTypes = {
  user: UserNode,
  step: StepNode,
  status: StatusNode,
  siteGroup: SiteGroupNode,
};

const GROUP_W = 1480;
const GROUP_H = 560;

function CarIncidentFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const n: Node[] = [
      {
        id: "user",
        type: "user",
        position: { x: 24, y: 180 },
        data: {},
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 220, y: 24 },
        data: {},
        style: { width: GROUP_W, height: GROUP_H },
      },
      {
        id: "firestore",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 36, y: 140 },
        data: { label: "Firestore", logo: "/brands/firestore.png" },
      },
      {
        id: "vertex",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 220, y: 120 },
        data: {
          label: "Vertex AI",
          logo: "/brands/vertex-ai.svg",
          lines: ["AutoML Image Class", "~$1.375/hr"],
        },
      },
      {
        id: "gemini",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 420, y: 110 },
        data: {
          label: "Gemini",
          logo: "/brands/gemini.png",
          lines: ["gemini-3.5-flash-lite", "~$0.0002–$0.0005"],
          outBottom: true,
        },
      },
      {
        id: "validated",
        type: "status",
        parentId: "site",
        extent: "parent",
        position: { x: 640, y: 70 },
        data: { label: "Validated", tone: "ok" },
      },
      {
        id: "rejected",
        type: "status",
        parentId: "site",
        extent: "parent",
        position: { x: 640, y: 280 },
        data: { label: "Rejected", tone: "bad" },
      },
      {
        id: "dispatch-officer",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 860, y: 24 },
        data: {
          label: "Dispatched officer",
          logo: "/brands/officer.png",
          lines: ["same time as BFP"],
        },
      },
      {
        id: "dispatch-firestation",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 860, y: 160 },
        data: {
          label: "Dispatched Firestation",
          logo: "/map/bfp-helmet.png",
          lines: ["same time as officer"],
        },
      },
      {
        id: "mark-done",
        type: "status",
        parentId: "site",
        extent: "parent",
        position: { x: 1100, y: 90 },
        data: { label: "Mark done", tone: "ok" },
      },
      {
        id: "bq",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 860, y: 320 },
        data: {
          label: "BigQuery",
          logo: "/brands/bigquery.png",
          outRight: false,
        },
      },
      {
        id: "twilio",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1100, y: 240 },
        data: {
          label: "Twilio",
          logo: "/brands/twilio.png",
          lines: [
            "nearest services",
            "AI Text and AI Call",
            "₱51 / 3 min call",
          ],
          outRight: false,
        },
      },
      {
        id: "resend",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1100, y: 380 },
        data: {
          label: "Resend",
          logo: "/brands/resend.png",
          outRight: false,
        },
      },
    ];

    const redMarker = {
      type: MarkerType.ArrowClosed,
      color: RED,
    } as const;
    const greenMarker = {
      type: MarkerType.ArrowClosed,
      color: GREEN,
    } as const;
    const red = { stroke: RED, strokeWidth: 1.75 };
    const green = { stroke: GREEN, strokeWidth: 1.75 };
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
      labelStyle: { fill: "#5c6570", fontSize: 10 },
    };

    const e: Edge[] = [
      {
        id: "e-report",
        source: "user",
        sourceHandle: "out",
        target: "firestore",
        targetHandle: "in",
        label: "report fire incident · 1-20 at same time",
        markerEnd: redMarker,
        style: red,
        ...labelBg,
      },
      {
        id: "e-queue",
        source: "firestore",
        sourceHandle: "out",
        target: "vertex",
        targetHandle: "in",
        label: "queue",
        markerEnd: redMarker,
        style: red,
        ...labelBg,
      },
      {
        id: "e-vertex-gemini",
        source: "vertex",
        sourceHandle: "out",
        target: "gemini",
        targetHandle: "in",
        markerEnd: redMarker,
        style: red,
      },
      {
        id: "e-valid",
        source: "gemini",
        sourceHandle: "out",
        target: "validated",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-reject",
        source: "gemini",
        sourceHandle: "down",
        target: "rejected",
        targetHandle: "in-top",
        markerEnd: redMarker,
        style: red,
      },
      {
        id: "e-dispatch-officer",
        source: "validated",
        sourceHandle: "out",
        target: "dispatch-officer",
        targetHandle: "in",
        label: "dispatch · same time",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-dispatch-fire",
        source: "validated",
        sourceHandle: "out",
        target: "dispatch-firestation",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-officer-done",
        source: "dispatch-officer",
        sourceHandle: "out",
        target: "mark-done",
        targetHandle: "in",
        label: "close report",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-fire-done",
        source: "dispatch-firestation",
        sourceHandle: "out",
        target: "mark-done",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-bq",
        source: "validated",
        sourceHandle: "down",
        target: "bq",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-twilio",
        source: "mark-done",
        sourceHandle: "out",
        target: "twilio",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-resend-ok",
        source: "mark-done",
        sourceHandle: "down",
        target: "resend",
        targetHandle: "in",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-resend-bad",
        source: "rejected",
        sourceHandle: "down",
        target: "resend",
        targetHandle: "in",
        markerEnd: redMarker,
        style: red,
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
  } = useFlowLayout("fire-incident-v3", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden bg-[#eef1f5]">
      {hasSavedLayout ? (
        <button
          type="button"
          onClick={resetLayout}
          className="absolute top-3 right-3 z-10 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          Reset layout
        </button>
      ) : null}
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
          fitViewOptions={{ padding: 0.12 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          minZoom={0.35}
          maxZoom={1.5}
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

export function CarIncidentFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Simple Fire Incident Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Report → Firestore → Vertex → Gemini → Validated (BigQuery, Twilio,
          Resend) or Rejected → Resend.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <CarIncidentFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
