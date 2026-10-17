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

function siteWidth(site: Node): number {
  const s = site.style as { width?: number } | undefined;
  return Number(s?.width ?? site.width ?? 0) || 900;
}

/** Field investigate must stay outside the Ugnaiph.com site box. */
function clampOutsideSite(nodes: Node[], nodeId: string): Node[] {
  const site = nodes.find((n) => n.id === "site");
  if (!site) return nodes;
  const minX = site.position.x + siteWidth(site) + 24;
  return nodes.map((n) => {
    if (n.id !== nodeId) return n;
    const data = n.data as { keepOutside?: boolean } | undefined;
    if (!data?.keepOutside) return n;
    let position = n.position;
    if (n.parentId === "site") {
      position = {
        x: site.position.x + n.position.x,
        y: site.position.y + n.position.y,
      };
    }
    if (position.x < minX) {
      position = { ...position, x: minX };
    }
    const { parentId: _p, extent: _e, ...rest } = n;
    return { ...rest, position, parentId: undefined, extent: undefined };
  });
}

function hydrateEdges(defaults: Edge[]): Edge[] {
  return defaults.map((e) => ({ ...e, reconnectable: true }));
}

/** Legacy key from when layouts were persisted in the browser. */
function legacyStorageKey(flowId: string) {
  return `luwas.dev.flow.layout.${flowId}`;
}

export function useFlowLayout(
  flowId: string,
  defaultNodes: Node[] = [],
  defaultEdges: Edge[] = [],
) {
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
          const logos = Array.isArray(data?.logosAbove)
            ? (data.logosAbove as string[]).join(",")
            : Array.isArray(data?.logos)
              ? (data.logos as string[]).join(",")
              : String(data?.logo ?? "");
          return `${n.id}:${n.position.x},${n.position.y}:${s?.width ?? ""}x${s?.height ?? ""}:${handles}:${logos}`;
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
    // Drop stale browser layouts so diagrams always come from code defaults.
    if (typeof window !== "undefined" && flowId) {
      try {
        window.localStorage.removeItem(legacyStorageKey(flowId));
      } catch {
        /* ignore */
      }
    }
    setNodes(hydrateNodes(defaultNodes ?? []));
    setEdges(hydrateEdges(defaultEdges ?? []));
    setViewport(undefined);
    setHydrated(true);
    setCanvasKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- defaultsKey tracks identity
  }, [flowId, defaultsKey]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((prev) => {
      let next = applyNodeChanges(changes, prev);
      for (const n of next) {
        const data = n.data as { keepOutside?: boolean } | undefined;
        if (data?.keepOutside && (n.parentId || changes.some((c) => "id" in c && c.id === n.id))) {
          next = clampOutsideSite(next, n.id);
        }
      }
      return next;
    });
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onNodeDragStop = useCallback(
    (_: unknown, node: Node) => {
      const data = node.data as { keepOutside?: boolean } | undefined;
      if (!data?.keepOutside) return;
      setNodes((prev) => clampOutsideSite(prev, node.id));
    },
    [],
  );

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
