"use client";

import { useMemo } from "react";
import Image from "next/image";
import { BrandLogo } from "@/components/BrandLogo";
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
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const DOT = "!size-2 !bg-[#c72929] !border-0";

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    logo?: string;
    logos?: string[];
    inLeft?: boolean;
    outRight?: boolean;
    outTop?: boolean;
    outBot?: boolean;
    inTop?: boolean;
    inBot?: boolean;
  };
  const logos = d.logos ?? (d.logo ? [d.logo] : []);
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 148 }}>
      {d.inLeft ? (
        <Handle type="target" position={Position.Left} id="in" className={DOT} />
      ) : null}
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-top"
          style={{ top: "30%" }}
          className={DOT}
        />
      ) : null}
      {d.inBot ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-bot"
          style={{ top: "70%" }}
          className={DOT}
        />
      ) : null}
      <div className="flex items-center justify-center gap-1.5">
        {logos.length === 0 ? (
          <BrandLogo size={18} wordmarkClassName="text-sm" />
        ) : (
          logos.map((src) => (
            <Image
              key={src}
              src={src}
              alt=""
              width={36}
              height={36}
              className="size-9 object-contain"
            />
          ))
        )}
      </div>
      <p className={flowLabelClass}>{d.label}</p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      {d.outRight ? (
        <Handle type="source" position={Position.Right} id="out" className={DOT} />
      ) : null}
      {d.outTop ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-top"
          style={{ top: "30%" }}
          className={DOT}
        />
      ) : null}
      {d.outBot ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-bot"
          style={{ top: "70%" }}
          className={DOT}
        />
      ) : null}
    </div>
  );
}

const nodeTypes = { step: StepNode };

function BarangayOnboardFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const n: Node[] = [
      {
        id: "dev",
        type: "step",
        position: { x: 16, y: 160 },
        data: {
          label: "Developer",
          lines: ["/dev/onboard"],
          outRight: true,
        },
      },
      {
        id: "orient",
        type: "step",
        position: { x: 200, y: 160 },
        data: {
          label: "Orientation",
          lines: ["What UGNAI is"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "pick",
        type: "step",
        position: { x: 384, y: 160 },
        data: {
          label: "Pick barangay",
          logo: "/brands/google-maps.png",
          lines: ["Cebu LGU list"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "hall",
        type: "step",
        position: { x: 568, y: 160 },
        data: {
          label: "Hall pin",
          logo: "/brands/google-maps.png",
          lines: ["Map click · geocode"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "org",
        type: "step",
        position: { x: 752, y: 160 },
        data: {
          label: "Org profile",
          logo: "/brands/officer.png",
          lines: ["MDRRMO · hotline"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "officers",
        type: "step",
        position: { x: 936, y: 160 },
        data: {
          label: "Add officers",
          logo: "/brands/officer.png",
          lines: ["Captain · MDRRMO", "Staff on Users"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "homeowners",
        type: "step",
        position: { x: 1120, y: 160 },
        data: {
          label: "Add homeowners",
          logo: "/brands/citizens.png",
          lines: ["Real roster · CSV"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "activate",
        type: "step",
        position: { x: 1304, y: 160 },
        data: {
          label: "Activate",
          logo: "/brands/firebase.png",
          lines: ["Firestore barangays"],
          inLeft: true,
          outTop: true,
          outBot: true,
        },
      },
      {
        id: "command",
        type: "step",
        position: { x: 1488, y: 72 },
        data: {
          label: "Command center",
          lines: ["Map prefers area"],
          inLeft: true,
        },
      },
      {
        id: "residents",
        type: "step",
        position: { x: 1488, y: 248 },
        data: {
          label: "Investigate incidents",
          logo: "/brands/citizens.png",
          lines: ["House roster · map"],
          inLeft: true,
        },
      },
    ];

    const marker = {
      type: MarkerType.ArrowClosed,
      color: "#c72929",
    } as const;
    const style = { stroke: "#c72929", strokeWidth: 1.75 };

    const e: Edge[] = [
      {
        id: "e-orient",
        source: "dev",
        sourceHandle: "out",
        target: "orient",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-pick",
        source: "orient",
        sourceHandle: "out",
        target: "pick",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-hall",
        source: "pick",
        sourceHandle: "out",
        target: "hall",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-org",
        source: "hall",
        sourceHandle: "out",
        target: "org",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-officers",
        source: "org",
        sourceHandle: "out",
        target: "officers",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-homeowners",
        source: "officers",
        sourceHandle: "out",
        target: "homeowners",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-activate",
        source: "homeowners",
        sourceHandle: "out",
        target: "activate",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-command",
        source: "activate",
        sourceHandle: "out-top",
        target: "command",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-residents",
        source: "activate",
        sourceHandle: "out-bot",
        target: "residents",
        targetHandle: "in",
        markerEnd: marker,
        style,
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
  } = useFlowLayout("barangay-onboard-v3", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-[#eef1f5]">
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
          minZoom={0.3}
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

export function BarangayOnboardFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Barangay Onboard Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Real barangay standup: orientation → pick → hall pin → org profile →
          add officers → add homeowners → activate → command center + investigate
          incidents.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <BarangayOnboardFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
