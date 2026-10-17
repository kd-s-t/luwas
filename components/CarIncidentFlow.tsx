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
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const RED = "#c72929";
const GREEN = "#16794c";

function UserNode({ data }: NodeProps) {
  const d = data as {
    label?: string;
    logo?: string;
    /** Target on the right (node left of Firebase). */
    inRight?: boolean;
    /** Target on the left (node right of Firebase). */
    inLeft?: boolean;
    outRight?: boolean;
  };
  const color = d.inRight || d.inLeft ? GREEN : RED;
  return (
    <div className={flowNodeClass} style={{ width: 140 }}>
      <Image
        src={d.logo ?? "/brands/citizens.png"}
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>
        {d.label ?? "Non Register or Registered user"}
      </p>
      {d.inLeft ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {d.inRight ? (
        <Handle
          type="target"
          position={Position.Right}
          id="in"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {d.outRight !== false ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
    </div>
  );
}

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    logo?: string;
    logos?: string[];
    inLeft?: boolean;
    inTop?: boolean;
    inBottom?: boolean;
    outRight?: boolean;
    outBottom?: boolean;
  };
  const meta = (d.lines ?? []).filter((l) => !isFlowCostLine(l));
  const costs = (d.lines ?? []).filter(isFlowCostLine);
  const logos =
    d.logos?.length ? d.logos : d.logo ? [d.logo] : [];
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 140 }}>
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Top}
          id="in-top"
          className="!size-2 !border-0"
          style={{ background: RED }}
        />
      ) : null}
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
  const d = data as {
    label: string;
    tone: "ok" | "bad";
    /** Rejected: top + right only. */
    handles?: "top-right";
    /** Hide top handle (e.g. Mark done). */
    noTop?: boolean;
  };
  const color = d.tone === "ok" ? GREEN : RED;
  const isOk = d.tone === "ok";
  const topRightOnly = d.handles === "top-right";
  const showTop = !d.noTop;
  return (
    <div
      className="relative rounded-[8px] border bg-white px-3 py-2 text-center text-sm font-semibold"
      style={{ color, borderColor: color }}
    >
      {showTop && isOk ? (
        <Handle
          type="source"
          position={Position.Top}
          id="up"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {showTop && !isOk ? (
        <Handle
          type="target"
          position={Position.Top}
          id="in-top"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {!topRightOnly ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
      {d.label}
      <Handle
        type="source"
        position={Position.Right}
        id="out"
        className="!size-2 !border-0"
        style={{ background: color }}
      />
      {!topRightOnly ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="down"
          className="!size-2 !border-0"
          style={{ background: color }}
        />
      ) : null}
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
        position: { x: -42, y: 365 },
        data: {
          label: "Non Register or Registered user",
          logo: "/brands/citizens.png",
        },
      },
      {
        id: "bq",
        type: "step",
        position: { x: 640, y: 8 },
        data: {
          label: "BigQuery",
          logo: "/brands/bigquery.png",
          inLeft: false,
          inBottom: true,
          outRight: false,
        },
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 218.30909090909108, y: 141.76363636363635 },
        data: {},
        style: { width: GROUP_W, height: GROUP_H },
      },
      {
        id: "firestore",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 38, y: 94 },
        data: {
          label: "Firestore",
          logo: "/brands/firestore.png",
          outBottom: true,
        },
      },
      {
        id: "vertex",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 36, y: 380 },
        data: {
          label: "Vertex AI",
          logo: "/brands/vertex-ai.svg",
          lines: ["AutoML Image Class", "~$1.375/hr"],
          inTop: true,
          inLeft: false,
        },
      },
      {
        id: "gemini",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 234, y: 95 },
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
        position: { x: 447.69090909090903, y: 124 },
        data: { label: "Validated", tone: "ok" },
      },
      {
        id: "rejected",
        type: "status",
        parentId: "site",
        extent: "parent",
        position: { x: 263, y: 414 },
        data: { label: "Rejected", tone: "bad", handles: "top-right" },
      },
      {
        id: "reject-notify",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 452, y: 377 },
        data: {
          label: "Twilio + Resend",
          logos: ["/brands/twilio.png", "/brands/resend.png"],
          lines: ["AI Text only", "email · no call"],
          outRight: false,
        },
      },
      {
        id: "dispatch-officer",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 706.3818181818183, y: 77.07272727272726 },
        data: {
          label: "Dispatched officer",
          logo: "/brands/officer.png",
          lines: ["only officer marks done"],
        },
      },
      {
        id: "twilio",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 703.5454545454546, y: 240.45454545454544 },
        data: {
          label: "Twilio",
          logo: "/brands/twilio.png",
          lines: [
            "nearest services",
            "AI Text and AI Call",
            "₱51 / 3 min call",
          ],
          inLeft: true,
          outBottom: true,
          outRight: false,
        },
      },
      {
        id: "mark-done",
        type: "status",
        parentId: "site",
        extent: "parent",
        position: { x: 1048.3090909090909, y: 120.38181818181818 },
        data: { label: "Mark done", tone: "ok", noTop: true },
      },
      {
        id: "dispatch-firestation",
        type: "step",
        position: { x: 928, y: 728 },
        data: {
          label: "Dispatched Fireman",
          logo: "/map/bfp-helmet.png",
          lines: ["after Twilio alert"],
          inTop: true,
          inLeft: false,
          outRight: false,
        },
      },
      {
        id: "resend",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 1025, y: 359 },
        data: {
          label: "Resend",
          logo: "/brands/resend.png",
          inTop: true,
          inLeft: false,
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
        markerEnd: redMarker,
        style: red,
      },
      {
        id: "e-queue",
        source: "firestore",
        sourceHandle: "down",
        target: "vertex",
        targetHandle: "in-top",
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
        label: "dispatch officer",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-twilio",
        source: "validated",
        sourceHandle: "down",
        target: "twilio",
        targetHandle: "in",
        label: "alert",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-twilio-bfp",
        source: "twilio",
        sourceHandle: "down",
        target: "dispatch-firestation",
        targetHandle: "in-top",
        label: "dispatch BFP",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-officer-done",
        source: "dispatch-officer",
        sourceHandle: "out",
        target: "mark-done",
        targetHandle: "in",
        label: "officer closes report",
        markerEnd: greenMarker,
        style: green,
        ...labelBg,
      },
      {
        id: "e-bq",
        source: "validated",
        sourceHandle: "up",
        target: "bq",
        targetHandle: "in-bottom",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-resend-ok",
        source: "mark-done",
        sourceHandle: "down",
        target: "resend",
        targetHandle: "in-top",
        markerEnd: greenMarker,
        style: green,
      },
      {
        id: "e-reject-notify",
        source: "rejected",
        sourceHandle: "out",
        target: "reject-notify",
        targetHandle: "in",
        label: "text + email",
        markerEnd: redMarker,
        style: red,
        ...labelBg,
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
  } = useFlowLayout("fire-incident", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="fire-incident"
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
          Fire Incident Flow
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
