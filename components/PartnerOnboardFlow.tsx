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
import { FlowCopyJsonButton } from "@/components/flow/FlowCopyJsonButton";
import { useFlowLayout } from "@/components/flow/useFlowLayout";

const DOT = "!size-2 !bg-[#2f5f9e] !border-0";
const SITE_W = 280;
const SITE_H = 220;

function StepNode({ data }: NodeProps) {
  const d = data as {
    label: string;
    lines?: string[];
    logo?: string;
    /** Brand marks rendered above the card, not inside it. */
    logosAbove?: string[];
    inLeft?: boolean;
    outRight?: boolean;
  };
  return (
    <div
      className={`relative overflow-visible ${flowNodeClass}`}
      style={{ width: 156 }}
    >
      {d.logosAbove?.length ? (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 flex w-max -translate-x-1/2 items-center gap-2">
          {d.logosAbove.map((src) => {
            const ocd = src.includes("ocd.png");
            return (
              // eslint-disable-next-line @next/next/no-img-element -- brand assets in flow canvas
              <img
                key={src}
                src={src}
                alt=""
                width={ocd ? 39 : 44}
                height={44}
                className={
                  ocd ? "h-11 w-[39px] object-contain" : "size-11 object-contain"
                }
              />
            );
          })}
        </div>
      ) : null}
      {d.inLeft ? (
        <Handle type="target" position={Position.Left} id="in" className={DOT} />
      ) : null}
      {d.logo ? (
        // eslint-disable-next-line @next/next/no-img-element -- brand assets in flow canvas
        <img
          src={d.logo}
          alt=""
          width={36}
          height={36}
          className="size-9 object-contain"
        />
      ) : null}
      <p className={flowLabelClass}>{d.label}</p>
      {d.lines?.map((line) => (
        <p key={line} className={flowMetaClass}>
          {line}
        </p>
      ))}
      {d.outRight ? (
        <Handle
          type="source"
          position={Position.Right}
          id="out"
          className={DOT}
        />
      ) : null}
    </div>
  );
}

function SiteGroupNode(_props: NodeProps) {
  return (
    <div className="relative h-full w-full rounded-[8px] border border-[var(--border)] bg-white/60">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-[8px] bg-[#2f5f9e]" />
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

const nodeTypes = { step: StepNode, siteGroup: SiteGroupNode };

function PartnerOnboardFlowCanvas() {
  const { defaultNodes, defaultEdges } = useMemo(() => {
    const labelBg = {
      labelBgStyle: { fill: "#eef1f5" },
      labelBgPadding: [4, 6] as [number, number],
    };
    const marker = {
      type: MarkerType.ArrowClosed,
      color: "#2f5f9e",
    } as const;
    const stroke = { stroke: "#2f5f9e", strokeWidth: 1.75 };

    const n: Node[] = [
      {
        id: "identify",
        type: "step",
        position: { x: -98.42589437819422, y: 137.1175468483816 },
        className: "!overflow-visible",
        style: { overflow: "visible" },
        data: {
          label: "Identify partner",
          logosAbove: [
            "/brands/philippine-red-cross.png",
            "/brands/dswd.png",
            "/brands/ocd.png",
          ],
          lines: ["NGO · DSWD · LGU", "Private · Other"],
          outRight: true,
        },
      },
      {
        id: "meeting",
        type: "step",
        position: { x: 171.85689948892673, y: 116.79045996592845 },
        data: {
          label: "Meeting",
          logo: "/brands/officer.png",
          lines: ["Supply needs", "Coverage area"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "agreement",
        type: "step",
        position: { x: 430.3713798977854, y: 116.79045996592845 },
        data: {
          label: "Agreement",
          logo: "/brands/officer.png",
          lines: ["Commit to supply", "No partner login"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "contact",
        type: "step",
        position: { x: 700.6541737649063, y: 134.46678023850086 },
        data: {
          label: "Contact details",
          lines: ["Person", "Phone · Email"],
          inLeft: true,
          outRight: true,
        },
      },
      {
        id: "site",
        type: "siteGroup",
        position: { x: 911.9784368297787, y: 72.86792485685017 },
        data: {},
        style: { width: SITE_W, height: SITE_H },
        width: SITE_W,
        height: SITE_H,
      },
      {
        id: "directory",
        type: "step",
        parentId: "site",
        extent: "parent",
        position: { x: 64.36555761984152, y: 55.35976457722812 },
        data: {
          label: "Partners directory",
          logo: "/brands/firestore.png",
          inLeft: true,
        },
      },
    ];

    const e: Edge[] = [
      {
        id: "e-identify-meeting",
        source: "identify",
        sourceHandle: "out",
        target: "meeting",
        targetHandle: "in",
        label: "schedule",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-meeting-agreement",
        source: "meeting",
        sourceHandle: "out",
        target: "agreement",
        targetHandle: "in",
        label: "align",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-agreement-contact",
        source: "agreement",
        sourceHandle: "out",
        target: "contact",
        targetHandle: "in",
        label: "they provide",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
        ...labelBg,
      },
      {
        id: "e-contact-directory",
        source: "contact",
        sourceHandle: "out",
        target: "directory",
        targetHandle: "in",
        label: "record",
        markerEnd: marker,
        style: stroke,
        labelStyle: { fill: "#5c6570", fontSize: 11 },
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
  } = useFlowLayout("partner-onboard-v6", defaultNodes, defaultEdges);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden bg-[#eef1f5]">
      <div className="absolute top-3 right-3 z-10 flex gap-2">
        <FlowCopyJsonButton
          flowId="partner-onboard-v6"
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

export function PartnerOnboardFlow() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold tracking-wide">
          Partner Onboard Flow
        </h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Identify → meeting → agreement → contact → Partners directory (inside
          Ugnaiph.com). Directory only. No partner login.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlowProvider>
          <PartnerOnboardFlowCanvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
