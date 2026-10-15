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
  flowLabelClass,
  flowMetaClass,
  flowNodeClass,
} from "@/components/flow/FlowMark";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

function NewUsersNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 120 }}>
      <Image
        src="/brands/citizens.png"
        alt=""
        width={40}
        height={40}
        className="size-10 object-contain"
      />
      <p className={flowLabelClass}>new users</p>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function GeminiNode(_props: NodeProps) {
  return (
    <div className={flowNodeClass} style={{ width: 120 }}>
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !bg-[#c72929] !border-0"
      />
      <Image
        src="/brands/gemini.png"
        alt="Gemini"
        width={36}
        height={36}
        className="size-9 object-contain"
      />
      <p className={flowLabelClass}>Gemini</p>
      <p className={flowMetaClass}>ID check</p>
      <Handle
        type="source"
        position={Position.Right}
        id="valid"
        style={{ top: "35%" }}
        className="!size-2 !bg-[#16794c] !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="invalid"
        style={{ top: "70%" }}
        className="!size-2 !bg-[#c72929] !border-0"
      />
    </div>
  );
}

function OutcomeNode({ data }: NodeProps) {
  const d = data as {
    title: string;
    lines?: string[];
    logo?: string;
    logos?: string[];
    inTop?: boolean;
    inBot?: boolean;
    outValid?: boolean;
    outRejected?: boolean;
  };
  const logos = d.logos ?? (d.logo ? [d.logo] : []);
  return (
    <div className={flowNodeClass} style={{ width: 180 }}>
      {d.inTop || d.inBot ? (
        <>
          {d.inTop ? (
            <Handle
              type="target"
              position={Position.Left}
              id="in-top"
              style={{ top: "30%" }}
              className="!size-2 !bg-[#16794c] !border-0"
            />
          ) : null}
          {d.inBot ? (
            <Handle
              type="target"
              position={Position.Left}
              id="in-bot"
              style={{ top: "70%" }}
              className="!size-2 !bg-[#16794c] !border-0"
            />
          ) : null}
        </>
      ) : (
        <Handle
          type="target"
          position={Position.Left}
          className="!size-2 !bg-[#c72929] !border-0"
        />
      )}
      {logos.length > 0 ? (
        <div className="mb-1 flex items-center justify-center gap-2">
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
      <p className={flowLabelClass}>{d.title}</p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      {d.outValid ? (
        <Handle
          type="source"
          position={Position.Right}
          id="valid"
          style={{ top: "35%" }}
          className="!size-2 !bg-[#16794c] !border-0"
        />
      ) : null}
      {d.outRejected ? (
        <Handle
          type="source"
          position={Position.Right}
          id="rejected"
          style={{ top: "70%" }}
          className="!size-2 !bg-[#c72929] !border-0"
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
        Luwasph.com
      </p>
    </div>
  );
}

const nodeTypes = {
  newUsers: NewUsersNode,
  gemini: GeminiNode,
  outcome: OutcomeNode,
  siteGroup: SiteGroupNode,
};

const GROUP_W = 780;
const GROUP_H = 360;

function RegistrationFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
    };
    const n: Node[] = [
      {
        id: "new-users",
        type: "newUsers",
        position: { x: 24, y: 150 },
        data: {},
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 220, y: 40 },
        data: {},
        style: { width: GROUP_W, height: GROUP_H },
      },
      {
        id: "gemini",
        type: "gemini",
        parentId: "site",
        extent: "parent",
        position: { x: 48, y: 120 },
        data: {},
      },
      {
        id: "sends-email",
        type: "outcome",
        parentId: "site",
        extent: "parent",
        position: { x: 280, y: 56 },
        data: {
          title: "sends email",
          logo: "/brands/resend.png",
          inTop: true,
          inBot: true,
        },
      },
      {
        id: "officer",
        type: "outcome",
        parentId: "site",
        extent: "parent",
        position: { x: 280, y: 200 },
        data: {
          title: "Officer intervention:",
          logo: "/brands/officer.png",
          lines: ["Manual call", "Manual confirm"],
          outValid: true,
          outRejected: true,
        },
      },
      {
        id: "rejected",
        type: "outcome",
        parentId: "site",
        extent: "parent",
        position: { x: 540, y: 220 },
        data: {
          title: "Rejected",
          lines: ["Officer could not validate"],
        },
      },
    ];

    const e: Edge[] = [
      {
        id: "e-register",
        source: "new-users",
        target: "gemini",
        label: "registers with ID",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#c72929" },
        style: { stroke: "#c72929", strokeWidth: 1.75 },
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-valid",
        source: "gemini",
        sourceHandle: "valid",
        target: "sends-email",
        targetHandle: "in-top",
        label: "Valid",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16794c" },
        style: { stroke: "#16794c", strokeWidth: 1.75 },
        labelStyle: { fill: "#16794c", fontSize: 11, fontWeight: 600 },
        ...labelBg,
      },
      {
        id: "e-rejected",
        source: "gemini",
        sourceHandle: "invalid",
        target: "officer",
        label: "Rejected",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#c72929" },
        style: { stroke: "#c72929", strokeWidth: 1.75 },
        labelStyle: { fill: "#c72929", fontSize: 11, fontWeight: 600 },
        ...labelBg,
      },
      {
        id: "e-officer-valid",
        source: "officer",
        sourceHandle: "valid",
        target: "sends-email",
        targetHandle: "in-bot",
        label: "Valid",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#16794c" },
        style: { stroke: "#16794c", strokeWidth: 1.75 },
        labelStyle: { fill: "#16794c", fontSize: 11, fontWeight: 600 },
        ...labelBg,
      },
      {
        id: "e-officer-rejected",
        source: "officer",
        sourceHandle: "rejected",
        target: "rejected",
        label: "Rejected",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#c72929" },
        style: { stroke: "#c72929", strokeWidth: 1.75 },
        labelStyle: { fill: "#c72929", fontSize: 11, fontWeight: 600 },
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
  } = useFlowLayout("registration-v2", defaultNodes, defaultEdges);

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
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable
          nodesConnectable={false}
          elementsSelectable
          panOnScroll
          minZoom={0.45}
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

export function RegistrationFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Registration Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          New users register with ID. Gemini validates inside Luwasph.com
          (Firebase). Valid → sends email; Rejected → officer call → Valid
          (email) or Rejected (officer could not validate).
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <RegistrationFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
