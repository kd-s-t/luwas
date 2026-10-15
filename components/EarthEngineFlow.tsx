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
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const DOT = "!size-2 !bg-[#16794c] !border-0";

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    note?: string;
    lines?: string[];
    logo: string;
    in?: boolean;
    out?: boolean;
    outTop?: boolean;
    outBot?: boolean;
    inTop?: boolean;
    inBot?: boolean;
  };
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 150 }}>
      {d.note ? (
        <p className="absolute -top-6 left-1/2 w-max -translate-x-1/2 font-mono text-[10px] text-[var(--muted)]">
          {d.note}
        </p>
      ) : null}
      {d.in ? (
        <Handle
          type="target"
          position={Position.Left}
          className={DOT}
        />
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
      <Image
        src={d.logo}
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>{d.label}</p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      {d.out ? (
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

function EngineNode(_props: NodeProps) {
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 160 }}>
      <Handle type="target" position={Position.Left} className={DOT} />
      <Image
        src="/brands/earth-engine.webp"
        alt="Earth Engine"
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>Earth Engine</p>
      <p className={flowMetaClass}>SRTM DEM · FIRMS</p>
      <FlowCostsBelow costs={["Noncommercial $0", "~$0.40 / EECU-hr Limited"]} />
      <Handle
        type="source"
        position={Position.Right}
        id="out-top"
        style={{ top: "35%" }}
        className={DOT}
      />
      <Handle
        type="source"
        position={Position.Right}
        id="out-bot"
        style={{ top: "70%" }}
        className={DOT}
      />
    </div>
  );
}

const nodeTypes = {
  step: StepNode,
  engine: EngineNode,
};

function EarthEngineFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const n: Node[] = [
      {
        id: "trigger",
        type: "step",
        position: { x: 24, y: 130 },
        data: {
          label: "Dev run",
          logo: "/brand/luwas-logo.png",
          lines: ["ee:dem · ee:hazards"],
          out: true,
        },
      },
      {
        id: "ee",
        type: "engine",
        position: { x: 240, y: 110 },
        data: {},
      },
      {
        id: "dem",
        type: "step",
        position: { x: 460, y: 60 },
        data: {
          label: "DEM cache",
          logo: "/brands/google-elevation.jpg",
          lines: ["cebu / nangka JSON"],
          inTop: true,
          out: true,
        },
      },
      {
        id: "hazards",
        type: "step",
        position: { x: 460, y: 220 },
        data: {
          label: "Hazards cache",
          logo: "/brands/earth-engine.webp",
          lines: ["floods · fires"],
          inBot: true,
          out: true,
        },
      },
      {
        id: "storage",
        type: "step",
        position: { x: 680, y: 130 },
        data: {
          label: "Firebase Storage",
          logo: "/brands/firebase.png",
          lines: ["ee-cache/"],
          inTop: true,
          inBot: true,
          out: true,
        },
      },
      {
        id: "map",
        type: "step",
        position: { x: 900, y: 130 },
        data: {
          label: "Situation map",
          logo: "/brands/google-maps.png",
          lines: ["flood paint · elev"],
          in: true,
        },
      },
    ];

    const marker = {
      type: MarkerType.ArrowClosed,
      color: "#16794c",
    } as const;
    const style = { stroke: "#16794c", strokeWidth: 1.75 };
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
      labelStyle: { fill: "#5c6570", fontSize: 11 },
    };

    const e: Edge[] = [
      {
        id: "e-run",
        source: "trigger",
        sourceHandle: "out",
        target: "ee",
        label: "ADC / SA",
        markerEnd: marker,
        style,
        ...labelBg,
      },
      {
        id: "e-dem",
        source: "ee",
        sourceHandle: "out-top",
        target: "dem",
        targetHandle: "in-top",
        label: "SRTM",
        markerEnd: marker,
        style,
        ...labelBg,
      },
      {
        id: "e-firms",
        source: "ee",
        sourceHandle: "out-bot",
        target: "hazards",
        targetHandle: "in-bot",
        label: "FIRMS",
        markerEnd: marker,
        style,
        ...labelBg,
      },
      {
        id: "e-dem-store",
        source: "dem",
        sourceHandle: "out",
        target: "storage",
        targetHandle: "in-top",
        markerEnd: marker,
        style,
      },
      {
        id: "e-haz-store",
        source: "hazards",
        sourceHandle: "out",
        target: "storage",
        targetHandle: "in-bot",
        markerEnd: marker,
        style,
      },
      {
        id: "e-map",
        source: "storage",
        sourceHandle: "out",
        target: "map",
        label: "no EE per page load",
        markerEnd: marker,
        style,
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
  } = useFlowLayout("earth-engine", defaultNodes, defaultEdges);

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
          fitViewOptions={{ padding: 0.14 }}
          edgesReconnectable
          reconnectRadius={28}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          minZoom={0.35}
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

export function EarthEngineFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Earth Engine Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Manual ee:dem / ee:hazards (or /dev/earth-engine) → SRTM + FIRMS →
          JSON caches → Firebase Storage ee-cache → map flood paint. No EE call
          on page load.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <EarthEngineFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
