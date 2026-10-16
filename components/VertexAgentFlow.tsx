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
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    note?: string;
    logo?: string;
    costs?: string[];
    textOnly?: boolean;
    in?: boolean;
    inTop?: boolean;
    inBot?: boolean;
    out?: boolean;
    outTop?: boolean;
    outBot?: boolean;
  };
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 140 }}>
      {d.note ? (
        <p className="absolute -top-6 left-1/2 w-max -translate-x-1/2 font-mono text-[10px] text-[var(--muted)]">
          {d.note}
        </p>
      ) : null}
      {d.in ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in"
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-top"
          style={{ top: "30%" }}
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
      {d.inBot ? (
        <Handle
          type="target"
          position={Position.Left}
          id="in-bot"
          style={{ top: "70%" }}
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
      {d.logo && !d.textOnly ? (
        <Image
          src={d.logo}
          alt=""
          width={40}
          height={40}
          className="size-10 object-contain"
        />
      ) : null}
      <p className={flowLabelClass}>{d.label}</p>
      <FlowCostsBelow costs={d.costs} />
      {d.out ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
      {d.outTop ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-top"
          style={{ top: "30%" }}
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
      {d.outBot ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out-bot"
          style={{ top: "70%" }}
          className="!size-2 !bg-[#1d4ed8] !border-0"
        />
      ) : null}
    </div>
  );
}

const nodeTypes = {
  step: StepNode,
};

function VertexAgentFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
    };
    const marker = {
      type: MarkerType.ArrowClosed,
      color: "#1d4ed8",
    } as const;
    const stroke = { stroke: "#1d4ed8", strokeWidth: 1.75 };

    const n: Node[] = [
      {
        id: "bq",
        type: "step",
        position: { x: 40, y: 140 },
        data: {
          label: "bigQuery",
          note: "Schedule: Monthly",
          logo: "/brands/bigquery.png",
          outTop: true,
          outBot: true,
        },
      },
      {
        id: "gcs",
        type: "step",
        position: { x: 260, y: 140 },
        data: {
          label: "cloud storage",
          logo: "/brands/gcs.png",
          inTop: true,
          inBot: true,
          out: true,
        },
      },
      {
        id: "vertex",
        type: "step",
        position: { x: 480, y: 140 },
        data: {
          label: "Vertex AI",
          logo: "/brands/vertex-ai.svg",
          in: true,
          out: true,
        },
      },
      {
        id: "train",
        type: "step",
        position: { x: 700, y: 140 },
        data: {
          label: "Train",
          textOnly: true,
          costs: ["~$3.50 / hr", "one-off retrain"],
          in: true,
          out: true,
        },
      },
      {
        id: "deploy",
        type: "step",
        position: { x: 920, y: 140 },
        data: {
          label: "Deploy",
          textOnly: true,
          costs: ["~$1–5 / mo", "~1 hr serve"],
          in: true,
        },
      },
    ];

    const e: Edge[] = [
      {
        id: "e-images",
        source: "bq",
        sourceHandle: "out-top",
        target: "gcs",
        targetHandle: "in-top",
        label: "1000 images",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-csv",
        source: "bq",
        sourceHandle: "out-bot",
        target: "gcs",
        targetHandle: "in-bot",
        label: "CSV",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-feed",
        source: "gcs",
        sourceHandle: "out",
        target: "vertex",
        targetHandle: "in",
        label: "feed",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-train",
        source: "vertex",
        sourceHandle: "out",
        target: "train",
        targetHandle: "in",
        markerEnd: marker,
        style: stroke,
      },
      {
        id: "e-deploy",
        source: "train",
        sourceHandle: "out",
        target: "deploy",
        targetHandle: "in",
        markerEnd: marker,
        style: stroke,
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
  } = useFlowLayout("vertex-v2", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="vertex-v2"
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
          fitViewOptions={{ padding: 0.16 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          minZoom={0.4}
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

export function VertexAgentFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Gemini Agent Platform (Vertex AI Flow)
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Monthly BigQuery export (1000 images + CSV) → Cloud Storage → Vertex
          AI train / deploy / API ready.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <VertexAgentFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
