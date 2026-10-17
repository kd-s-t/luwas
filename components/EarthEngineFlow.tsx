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
  FlowCostsBelow,
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const DOT = "!size-2 !bg-[#16794c] !border-0";

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    note?: string;
    lines?: string[];
    logo?: string;
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
      {d.logo ? (
        <Image
          src={d.logo}
          alt=""
          width={40}
          height={40}
          className="size-10 object-contain"
        />
      ) : (
        <BrandLogo size={18} wordmarkClassName="text-sm" />
      )}
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
      <p className={flowMetaClass}>hills · fires</p>
      <FlowCostsBelow costs={["free for this use", "pay only if heavy run"]} />
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
        position: { x: -29.79775280898876, y: 119.43258426966293 },
        data: {
          label: "Dev run",
          lines: ["pull hills · pull fires"],
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
        position: { x: 467.685393258427, y: 14.848314606741575 },
        data: {
          label: "Hills DEM",
          logo: "/brands/google-elevation.jpg",
          lines: ["cebu samples"],
          inTop: true,
          out: true,
        },
      },
      {
        id: "hazards",
        type: "step",
        position: { x: 460, y: 220 },
        data: {
          label: "Flood · fire pins",
          logo: "/brands/earth-engine.webp",
          lines: ["hazard samples"],
          inBot: true,
          out: true,
        },
      },
      {
        id: "storage",
        type: "step",
        position: { x: 680.9606741573034, y: 118.47191011235955 },
        data: {
          label: "Database",
          logo: "/brands/firestore.png",
          lines: ["ee_datasets"],
          inTop: true,
          inBot: true,
          out: true,
        },
      },
      {
        id: "map",
        type: "step",
        position: { x: 977.8146067415731, y: 127.01993119555613 },
        data: {
          label: "Command center",
          lines: ["flood paint · height"],
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
        label: "service login",
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
        label: "hills",
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
        label: "fires",
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
        label: "reads database",
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
  } = useFlowLayout("earth-engine-v4", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="earth-engine-v4"
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
          Dev run pulls hills and fires from Earth Engine once, writes the
          database (ee_datasets), then command center reads those rows (no live
          Earth Engine on every page load).
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
