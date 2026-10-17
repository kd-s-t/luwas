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
    </div>
  );
}

function CommandNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 140 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <BrandLogo size={20} wordmarkClassName="text-sm" />
      <p className={flowLabelClass}>Command center</p>
      <Handle
        type="source"
        position={Position.Right}
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
          alt="Agent Nangka"
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
      <p className={flowLabelClass}>Chat agent</p>
      <p className={flowMetaClass}>
        run triage · gemini-1.5-flash-lite
      </p>
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
    "/brands/firestore.png",
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
      <p className={flowLabelClass}>Data sources</p>
      <p className={flowMetaClass}>Maps · EE · Elevation · Weather</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function BriefNode(_props: NodeProps) {
  return (
    <div
      className={flowNodeClass}
      style={{ width: 220 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <p className={flowLabelClass}>Information</p>
      <p className={flowMetaClass}>
        Residents, flood risk, elevated land, halls, Police, Fire, Hospital,
        School
      </p>
      <p className={`mt-1 ${flowLabelClass}`}>Preparation</p>
      <p className={flowMetaClass}>
        Station officers; stock food, water, flashlights, batteries, radios
      </p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function EvacNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 150 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Image
        src="/brands/citizens.png"
        alt=""
        width={36}
        height={36}
        className="size-9 object-contain"
      />
      <p className={flowLabelClass}>Who to prepare / evac early</p>
      <Handle
        type="source"
        position={Position.Right}
        id="sms"
        style={{ top: "35%" }}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="email"
        style={{ top: "70%" }}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function NotifyNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    action: string;
    cost?: string;
    logo?: string;
  };
  return (
    <div className={`relative ${flowNodeClass}`} style={{ width: 130 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      {d.logo ? (
        <Image
          src={d.logo}
          alt=""
          width={32}
          height={32}
          className="size-8 object-contain"
        />
      ) : (
        <FlowMark size={22} />
      )}
      <p className={flowLabelClass}>{d.label}</p>
      <p className={flowMetaClass}>{d.action}</p>
      <FlowCostsBelow costs={d.cost ? [d.cost] : undefined} />
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
  actor: ActorNode,
  command: CommandNode,
  triage: TriageNode,
  stack: StackNode,
  brief: BriefNode,
  evac: EvacNode,
  notify: NotifyNode,
  siteGroup: SiteGroupNode,
};

const GROUP_W = 1320;
const GROUP_H = 400;

function CalamityBeforeStormFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const n: Node[] = [
      {
        id: "officer",
        type: "actor",
        position: { x: -29.799276672694397, y: 170.34177215189874 },
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
        id: "command",
        type: "command",
        parentId: "site",
        extent: "parent",
        position: { x: 36, y: 160 },
        data: {},
      },
      {
        id: "stack",
        type: "stack",
        parentId: "site",
        extent: "parent",
        position: { x: 221.4773960216998, y: 41.466546112115736 },
        data: {},
      },
      {
        id: "triage",
        type: "triage",
        parentId: "site",
        extent: "parent",
        position: { x: 350.6726943942134, y: 200.23146473779389 },
        data: {},
      },
      {
        id: "brief",
        type: "brief",
        parentId: "site",
        extent: "parent",
        position: { x: 626.1301989150091, y: 104.54249547920435 },
        data: {},
      },
      {
        id: "evac",
        type: "evac",
        parentId: "site",
        extent: "parent",
        position: { x: 890.5623869801084, y: 128.63291139240505 },
        data: {},
      },
      {
        id: "twilio",
        type: "notify",
        parentId: "site",
        extent: "parent",
        position: { x: 1103.0650994575046, y: 68.97468354430382 },
        data: {
          label: "Twilio",
          action: "send Texts",
          cost: "₱0.50–₱0.56 / SMS",
          logo: "/brands/twilio.png",
        },
      },
      {
        id: "resend",
        type: "notify",
        parentId: "site",
        extent: "parent",
        position: { x: 1103.0650994575044, y: 231.13562386980107 },
        data: {
          label: "Resend",
          action: "send Emails",
          logo: "/brands/resend.png",
        },
      },
      {
        id: "people",
        type: "actor",
        position: { x: 1520, y: 160 },
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
        id: "e-enter",
        source: "officer",
        target: "command",
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
        id: "e-brief",
        source: "triage",
        target: "brief",
        markerEnd: marker,
        style,
      },
      {
        id: "e-evac",
        source: "brief",
        target: "evac",
        markerEnd: marker,
        style,
      },
      {
        id: "e-sms",
        source: "evac",
        sourceHandle: "sms",
        target: "twilio",
        markerEnd: marker,
        style,
      },
      {
        id: "e-email",
        source: "evac",
        sourceHandle: "email",
        target: "resend",
        markerEnd: marker,
        style,
      },
      {
        id: "e-people-sms",
        source: "twilio",
        target: "people",
        markerEnd: marker,
        style,
      },
      {
        id: "e-people-email",
        source: "resend",
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
  } = useFlowLayout("before-storm-v2", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[480px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="before-storm-v2"
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

export function CalamityBeforeStormFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Calamity: Before the Storm
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Before landfall is notification only: officer → command → data
          sources → triage → who to prepare / evac → SMS + email.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <CalamityBeforeStormFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
