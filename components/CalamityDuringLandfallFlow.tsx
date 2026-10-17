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
import { BrandLogo } from "@/components/BrandLogo";
import {
  FlowCostsBelow,
  FlowMark,
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

function ActorNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    citizens?: boolean;
    officer?: boolean;
    inLeft?: boolean;
    outRight?: boolean;
    inTop?: boolean;
    outBot?: boolean;
  };
  const src = d.citizens
    ? "/brands/citizens.png"
    : d.officer
      ? "/brands/officer.png"
      : null;
  return (
    <div className={flowNodeClass} style={{ width: 130 }}>
      {d.inLeft ? (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !bg-[#c72929] !border-0"
        />
      ) : null}
      {d.inTop ? (
        <Handle
          type="target"
          position={Position.Top}
          className="!size-2 !bg-[#c72929] !border-0"
        />
      ) : null}
      {src ? (
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          className="size-10 object-contain"
        />
      ) : (
        <FlowMark size={24} />
      )}
      <p className={flowLabelClass}>{d.label}</p>
      {d.outRight ? (
        <Handle
          type="source"
          position={Position.Right}
          className="!size-2 !bg-[#c72929] !border-0"
        />
      ) : null}
      {d.outBot ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!size-2 !bg-[#c72929] !border-0"
        />
      ) : null}
    </div>
  );
}

function CommandNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 140 }}>
      <Handle
        type="target"
        position={Position.Left}
        id="in"
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="in-top"
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <BrandLogo size={20} wordmarkClassName="text-sm" />
      <p className={flowLabelClass}>Command center</p>
      <p className={flowMetaClass}>Phase · During</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
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
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Image
        src="/brands/firebase.png"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
      <p className={flowLabelClass}>Incident reports</p>
      <p className={flowMetaClass}>Landfall and aftermath</p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function TriageNode(_props: NodeProps) {
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 200 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <div className="mb-0.5 flex items-center justify-center gap-2">
        <Image
          src="/mangugnai.jpg"
          alt="Mangugnai"
          width={40}
          height={40}
          className="size-10 rounded-full object-cover"
        />
        <Image
          src="/brands/gemini.png"
          alt="Gemini"
          width={36}
          height={36}
          className="size-9 object-contain"
        />
      </div>
      <p className={flowLabelClass}>Triage + validate</p>
      <p className={flowMetaClass}>Live queue · gemini-1.5-flash-lite</p>
      <FlowCostsBelow costs={["~$0.0002–$0.0005"]} />
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function StackNode(_props: NodeProps) {
  const logos = [
    "/brands/google-maps.png",
    "/brands/vertex-ai.svg",
    "/brands/firebase.png",
    "/brands/earth-engine.webp",
    "/brands/google-elevation.jpg",
    "/brands/google-weather.png",
  ] as const;
  return (
    <div className={flowNodeClass} style={{ width: 200 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {logos.map((src) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={24}
            height={24}
            className="size-6 object-contain"
          />
        ))}
      </div>
      <p className={flowLabelClass}>Live map</p>
      <p className={flowMetaClass}>Floods · reports · blocked lanes</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function SuggestNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 200 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <p className={flowLabelClass}>Suggest what to do</p>
      <p className={flowMetaClass}>
        Evac · investigate · shelter · roads blocked
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function OpsNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 160 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Image
        src="/brands/officer.png"
        alt=""
        width={32}
        height={32}
        className="size-8 object-contain"
      />
      <p className={flowLabelClass}>Dispatch</p>
      <p className={flowMetaClass}>Send team to the field</p>
      <p className={`mt-1 ${flowMetaClass}`}>No SMS / voice / email</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
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
  actor: ActorNode,
  command: CommandNode,
  report: ReportNode,
  triage: TriageNode,
  stack: StackNode,
  suggest: SuggestNode,
  ops: OpsNode,
  siteGroup: SiteGroupNode,
};

const GROUP_W = 1320;
const GROUP_H = 440;

function CalamityDuringLandfallFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const n: Node[] = [
      {
        id: "citizen",
        type: "actor",
        position: { x: -20.3254972875226, y: 108.54249547920433 },
        data: { label: "Citizen", citizens: true, outRight: true },
      },
      {
        id: "officer",
        type: "actor",
        position: { x: -5.189873417721522, y: 328.65280289330923 },
        data: { label: "Officer", officer: true, outRight: true },
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 180, y: 20 },
        data: {},
        style: { width: GROUP_W, height: GROUP_H },
      },
      {
        id: "report",
        type: "report",
        parentId: "site",
        extent: "parent",
        position: { x: 45.08137432188062, y: 78.27124773960217 },
        data: {},
      },
      {
        id: "command",
        type: "command",
        parentId: "site",
        extent: "parent",
        position: { x: 49.622061482820925, y: 310.4900542495478 },
        data: {},
      },
      {
        id: "stack",
        type: "stack",
        parentId: "site",
        extent: "parent",
        position: { x: 286.59674502712477, y: 88.91500904159133 },
        data: {},
      },
      {
        id: "triage",
        type: "triage",
        parentId: "site",
        extent: "parent",
        position: { x: 308.6437613019891, y: 257.51537070524415 },
        data: {},
      },
      {
        id: "suggest",
        type: "suggest",
        parentId: "site",
        extent: "parent",
        position: { x: 625.8354430379746, y: 190.32368896925857 },
        data: {},
      },
      {
        id: "ops",
        type: "ops",
        parentId: "site",
        extent: "parent",
        position: { x: 946.0542495479206, y: 168.21518987341773 },
        data: {},
      },
      {
        id: "people",
        type: "actor",
        position: { x: 1529.7287522603979, y: 192.75587703435806 },
        data: {
          label: "People within Barangay",
          citizens: true,
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
        id: "e-report",
        source: "citizen",
        target: "report",
        markerEnd: marker,
        style,
      },
      {
        id: "e-officer",
        source: "officer",
        target: "command",
        targetHandle: "in",
        markerEnd: marker,
        style,
      },
      {
        id: "e-report-cmd",
        source: "report",
        target: "command",
        targetHandle: "in-top",
        markerEnd: marker,
        style,
      },
      {
        id: "e-stack",
        source: "command",
        target: "stack",
        markerEnd: marker,
        style,
      },
      {
        id: "e-triage",
        source: "stack",
        target: "triage",
        markerEnd: marker,
        style,
      },
      {
        id: "e-suggest",
        source: "triage",
        target: "suggest",
        markerEnd: marker,
        style,
      },
      {
        id: "e-ops",
        source: "suggest",
        target: "ops",
        markerEnd: marker,
        style,
      },
      {
        id: "e-people",
        source: "ops",
        target: "people",
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
  } = useFlowLayout("during-landfall-v5", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[520px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="during-landfall-v5"
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
          fitViewOptions={{ padding: 0.1 }}
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

export function CalamityDuringLandfallFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Calamity: During Landfall
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Citizens report floods / blocked roads → officers run During on
          command → live map → triage + validate → suggest what to do →
          dispatch to the field → people (no SMS / voice / email).
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <CalamityDuringLandfallFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
