"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  applyEdgeChanges,
  applyNodeChanges,
  reconnectEdge,
  type Connection,
  type Edge,
  type Node,
  type OnEdgesChange,
  type OnNodesChange,
  type OnReconnect,
  type Viewport,
} from "@xyflow/react";

function hydrateNodes(defaults: Node[]): Node[] {
  return defaults.map((d) => ({
    ...d,
    draggable: true,
  }));
}

function hydrateEdges(defaults: Edge[]): Edge[] {
  return defaults.map((e) => ({ ...e, reconnectable: true }));
}

export function useFlowLayout(
  flowId: string,
  defaultNodes: Node[] = [],
  defaultEdges: Edge[] = [],
) {
  void flowId;

  const defaultsKey = useMemo(() => {
    const nodes = defaultNodes ?? [];
    const edges = defaultEdges ?? [];
    return (
      nodes
        .map((n) => {
          const s = n.style as { width?: number; height?: number } | undefined;
          const data = n.data as Record<string, unknown> | undefined;
          const handles = [
            data?.inLeft,
            data?.inBottom,
            data?.inTop,
            data?.outRight,
            data?.outTop,
            data?.outBottom,
          ].join(",");
          return `${n.id}:${n.position.x},${n.position.y}:${s?.width ?? ""}x${s?.height ?? ""}:${handles}`;
        })
        .join("|") +
      "|" +
      edges
        .map((e) => {
          const stroke =
            e.style && typeof e.style === "object" && "stroke" in e.style
              ? String((e.style as { stroke?: string }).stroke ?? "")
              : "";
          return `${e.id}:${String(e.label ?? "")}:${e.sourceHandle ?? ""}>${e.targetHandle ?? ""}:${stroke}`;
        })
        .join(",")
    );
  }, [defaultNodes, defaultEdges]);

  const [nodes, setNodes] = useState<Node[]>(() =>
    hydrateNodes(defaultNodes ?? []),
  );
  const [edges, setEdges] = useState<Edge[]>(() =>
    hydrateEdges(defaultEdges ?? []),
  );
  const [viewport, setViewport] = useState<Viewport | undefined>(undefined);
  const [hydrated, setHydrated] = useState(false);
  const [canvasKey, setCanvasKey] = useState(0);

  useEffect(() => {
    setNodes(hydrateNodes(defaultNodes ?? []));
    setEdges(hydrateEdges(defaultEdges ?? []));
    setViewport(undefined);
    setHydrated(true);
    setCanvasKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultsKey tracks identity
  }, [flowId, defaultsKey]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onNodeDragStop = useCallback(() => {}, []);

  const onMoveEnd = useCallback((_: unknown, next: Viewport) => {
    setViewport(next);
  }, []);

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection: Connection) => {
      setEdges((eds) => reconnectEdge(oldEdge, newConnection, eds));
    },
    [],
  );

  const resetLayout = useCallback(() => {
    setNodes(hydrateNodes(defaultNodes ?? []));
    setEdges(hydrateEdges(defaultEdges ?? []));
    setViewport(undefined);
    setCanvasKey((k) => k + 1);
  }, [defaultEdges, defaultNodes]);

  return {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onNodeDragStop,
    onMoveEnd,
    onReconnect,
    resetLayout,
    hasSavedLayout: false,
    defaultViewport: viewport,
    fitView: hydrated && !viewport,
    hydrated,
    canvasKey,
  };
}
